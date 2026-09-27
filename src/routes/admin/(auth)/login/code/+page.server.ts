import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
	clearChallenge,
	createSession,
	failChallenge,
	isRateLimited,
	readChallenge,
	registerFailure,
	setSessionCookie
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { safeNext, str } from '$lib/server/guard';
import { verifyTotp } from '$lib/server/totp';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const challenge = await readChallenge(cookies);
	if (!challenge) redirect(303, '/admin/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const ipKey = `code:${getClientAddress()}`;
		if (isRateLimited(ipKey, 10)) return fail(429, { error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });

		const challenge = await readChallenge(cookies);
		if (!challenge) redirect(303, '/admin/login');

		const code = str((await request.formData()).get('code'), 20);
		const user = await db.select().from(users).where(eq(users.id, challenge.userId)).get();
		if (!user?.active || !user.totpSecret) {
			await clearChallenge(cookies, challenge.id);
			redirect(303, '/admin/login');
		}

		const step = verifyTotp(user.totpSecret, code, user.totpLastStep);
		if (step == null) {
			await failChallenge(challenge.id);
			registerFailure(ipKey);
			const left = 4 - challenge.attempts;
			if (left <= 0) {
				await clearChallenge(cookies, challenge.id);
				redirect(303, '/admin/login');
			}
			return fail(400, { error: `Der Code stimmt nicht. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.` });
		}

		await db.update(users).set({ totpLastStep: step }).where(eq(users.id, user.id));
		await clearChallenge(cookies, challenge.id);
		const s = await createSession(user.id, challenge.persistent, request.headers.get('user-agent'));
		setSessionCookie(cookies, s.token, s.expiresAt, s.persistent);
		redirect(303, user.mustChangePassword ? '/admin/einrichtung' : safeNext(url.searchParams.get('weiter')));
	}
};
