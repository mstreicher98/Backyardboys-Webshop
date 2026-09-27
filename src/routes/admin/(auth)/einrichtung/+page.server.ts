import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { hashPassword, invalidateUserSessions, passwordProblem } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { setFlash } from '$lib/server/flash';
import { requireUser, str } from '$lib/server/guard';
import { generateSecret, groupSecret, otpauthUrl, verifyTotp } from '$lib/server/totp';
import type { Actions, PageServerLoad } from './$types';

/**
 * Ersteinrichtung nach dem ersten Login (oder nach einem Reset durch den Admin):
 * 1. eigenes Passwort festlegen, 2. Authenticator-App koppeln.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const me = requireUser(locals);
	if (!me.mustChangePassword && me.totpEnabled) redirect(303, '/admin');

	let qr: string | null = null;
	let secret: string | null = null;
	if (!me.mustChangePassword && !me.totpEnabled) {
		const row = await db.select({ totpSecret: users.totpSecret }).from(users).where(eq(users.id, me.id)).get();
		secret = row?.totpSecret ?? null;
		// Geheimnis bleibt bis zur Bestätigung gleich – ein Neuladen macht den Scan nicht ungültig
		if (!secret) {
			secret = generateSecret();
			await db.update(users).set({ totpSecret: secret, totpLastStep: null }).where(eq(users.id, me.id));
		}
		qr = await QRCode.toString(otpauthUrl(secret, me.username, 'Backyardboys Design'), {
			type: 'svg',
			margin: 1,
			errorCorrectionLevel: 'M',
			color: { dark: '#1d2b3a', light: '#ffffff' }
		});
	}

	return {
		step: me.mustChangePassword ? ('passwort' as const) : ('app' as const),
		name: me.name,
		qr,
		secret: secret ? groupSecret(secret) : null
	};
};

export const actions: Actions = {
	passwort: async ({ request, locals }) => {
		const me = requireUser(locals);
		const form = await request.formData();
		const password = String(form.get('passwort') ?? '');
		const problem = passwordProblem(password, String(form.get('passwort2') ?? ''));
		if (problem) return fail(400, { error: problem });
		await db
			.update(users)
			.set({ passwordHash: await hashPassword(password), mustChangePassword: false })
			.where(eq(users.id, me.id));
		// Andere Geräte mit dem alten Passwort abmelden
		await invalidateUserSessions(me.id, locals.sessionToken ?? undefined);
		redirect(303, '/admin/einrichtung');
	},

	app: async ({ request, locals, cookies }) => {
		const me = requireUser(locals);
		const code = str((await request.formData()).get('code'), 20);
		const row = await db.select({ totpSecret: users.totpSecret }).from(users).where(eq(users.id, me.id)).get();
		if (!row?.totpSecret) redirect(303, '/admin/einrichtung');
		const step = verifyTotp(row.totpSecret, code, null);
		if (step == null) {
			return fail(400, { error: 'Der Code stimmt nicht. Prüfe, ob die Uhrzeit am Handy stimmt, und versuche es mit dem nächsten Code.' });
		}
		await db.update(users).set({ totpEnabled: true, totpLastStep: step }).where(eq(users.id, me.id));
		setFlash(cookies, 'Einrichtung abgeschlossen – willkommen!');
		redirect(303, '/admin');
	},

	neu: async ({ locals }) => {
		const me = requireUser(locals);
		if (me.totpEnabled) redirect(303, '/admin');
		await db.update(users).set({ totpSecret: generateSecret(), totpLastStep: null }).where(eq(users.id, me.id));
		return { renewed: true };
	}
};
