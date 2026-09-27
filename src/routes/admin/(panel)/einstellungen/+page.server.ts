import fs from 'node:fs';
import { fail, redirect } from '@sveltejs/kit';
import { asc, desc, eq } from 'drizzle-orm';
import { euroInput, parseEuro } from '$lib/admin-labels';
import { formatBackupName } from '$lib/format';
import { logAction } from '$lib/server/audit';
import { clearSessionCookie } from '$lib/server/auth';
import { createBackup, listBackups } from '$lib/server/backup';
import { db, DB_FILE } from '$lib/server/db';
import { mailLog, shippingCountries } from '$lib/server/db/schema';
import { teamNoticeMail } from '$lib/server/emails';
import { checked, requirePermission, str } from '$lib/server/guard';
import { forgetTransport, sendMail, verifySmtp } from '$lib/server/mail';
import { uploadsSize } from '$lib/server/media';
import { stripeClient } from '$lib/server/payments/stripe';
import { RestoreError, restoreBackup } from '$lib/server/restore';
import { getSecrets, mask, saveSecrets } from '$lib/server/secrets';
import { companyGaps, getSettings, saveSettings } from '$lib/server/settings';
import { shopUrl } from '$lib/server/urls';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings.manage');
	const [s, secrets, countries, mails] = await Promise.all([
		getSettings(),
		getSecrets(),
		db.select().from(shippingCountries).orderBy(asc(shippingCountries.sortOrder), asc(shippingCountries.name)).all(),
		db.select().from(mailLog).orderBy(desc(mailLog.id)).limit(15).all()
	]);
	return {
		settings: s,
		gaps: companyGaps(s),
		secrets: {
			stripeSecretKey: mask(secrets.stripeSecretKey),
			stripeWebhookSecret: mask(secrets.stripeWebhookSecret),
			paypalClientId: mask(secrets.paypalClientId),
			paypalSecret: mask(secrets.paypalSecret),
			smtpPassword: secrets.smtpPassword ? '••••••' : ''
		},
		countries: countries.map((c) => ({ ...c, priceText: euroInput(c.price), freeFromText: euroInput(c.freeFrom) })),
		mails,
		webhookUrl: shopUrl('/api/zahlung/stripe'),
		backups: listBackups(),
		sizes: { db: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0, uploads: uploadsSize() }
	};
};

const https = (v: FormDataEntryValue | null) => {
	const s = str(v, 300);
	return !s || /^https:\/\//i.test(s) ? s : null;
};

export const actions: Actions = {
	firma: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		const social = { instagram: https(f.get('instagram')), facebook: https(f.get('facebook')), tiktok: https(f.get('tiktok')), youtube: https(f.get('youtube')) };
		if (Object.values(social).some((v) => v === null)) return fail(400, { error: 'Links zu sozialen Netzwerken müssen mit https:// beginnen.' });
		await saveSettings('company', {
			name: str(f.get('name'), 120) || 'Backyardboys OG',
			brand: str(f.get('marke'), 80) || 'Backyardboys Design',
			street: str(f.get('strasse'), 120),
			zip: str(f.get('plz'), 12),
			city: str(f.get('ort'), 80),
			country: str(f.get('land'), 60),
			email: str(f.get('email'), 120),
			phone: str(f.get('telefon'), 40),
			whatsapp: str(f.get('whatsapp'), 40),
			fn: str(f.get('fn'), 40),
			court: str(f.get('gericht'), 80),
			uid: str(f.get('uid'), 20).toUpperCase().replace(/\s/g, ''),
			representatives: str(f.get('vertretung'), 200),
			chamber: str(f.get('kammer'), 120),
			trade: str(f.get('gewerbe'), 200),
			authority: str(f.get('behoerde'), 120),
			iban: str(f.get('iban'), 40).toUpperCase(),
			bic: str(f.get('bic'), 20).toUpperCase(),
			bank: str(f.get('bank'), 80),
			instagram: social.instagram!,
			facebook: social.facebook!,
			tiktok: social.tiktok!,
			youtube: social.youtube!
		});
		await logAction(me.id, 'geändert', 'einstellungen', null, 'Firmendaten');
		return { message: 'Firmendaten gespeichert.' };
	},

	steuer: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		const mode = f.get('modus') === 'regel' ? 'regel' : 'kleinunternehmer';
		const rate = Math.round((Number(String(f.get('satz')).replace(',', '.')) || 20) * 100);
		await saveSettings('tax', { mode, standardRate: rate, oss: checked(f.get('oss')) });
		await saveSettings('orders', {
			invoicePrefix: str(f.get('praefix'), 10).replace(/[^A-Za-z0-9]/g, ''),
			transferDays: Math.min(60, Math.max(1, Number(f.get('tage')) || 7)),
			autoCancelHours: Math.min(720, Math.max(1, Number(f.get('storno_stunden')) || 48))
		});
		const s = await getSettings();
		if (mode === 'regel' && !s.company.uid) return { message: 'Gespeichert. Bitte noch die UID-Nummer unter „Firma“ eintragen – sie muss auf den Rechnungen stehen.' };
		await logAction(me.id, 'geändert', 'einstellungen', null, `Steuer: ${mode}`);
		return { message: 'Gespeichert. Gilt für neue Bestellungen.' };
	},

	zahlung: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		const patch: Record<string, string> = {};
		for (const [field, key] of [
			['stripe_key', 'stripeSecretKey'],
			['stripe_webhook', 'stripeWebhookSecret'],
			['paypal_id', 'paypalClientId'],
			['paypal_secret', 'paypalSecret']
		] as const) {
			const v = str(f.get(field), 300);
			if (v) patch[key] = v;
			if (f.get(`${field}_loeschen`) === 'on') patch[key] = '';
		}
		if (patch.stripeSecretKey && !/^(sk|rk)_(live|test)_/.test(patch.stripeSecretKey)) return fail(400, { error: 'Der Stripe-Schlüssel beginnt mit sk_live_ oder sk_test_ (bzw. rk_ für eingeschränkte Schlüssel).' });
		if (patch.stripeWebhookSecret && !patch.stripeWebhookSecret.startsWith('whsec_')) return fail(400, { error: 'Das Webhook-Secret beginnt mit whsec_.' });
		if (Object.keys(patch).length) await saveSecrets(patch);
		const secrets = await getSecrets();
		const stripe = checked(f.get('stripe'));
		const paypal = checked(f.get('paypal'));
		if (stripe && !secrets.stripeSecretKey) return fail(400, { error: 'Für Stripe bitte zuerst den geheimen Schlüssel eintragen.' });
		if (paypal && (!secrets.paypalClientId || !secrets.paypalSecret)) return fail(400, { error: 'Für PayPal bitte Client-ID und Secret eintragen.' });
		await saveSettings('payments', {
			stripe: { enabled: stripe },
			paypal: { enabled: paypal, sandbox: checked(f.get('paypal_sandbox')) },
			transfer: { enabled: checked(f.get('ueberweisung')) },
			cash: { enabled: checked(f.get('bar')) }
		});
		await logAction(me.id, 'geändert', 'einstellungen', null, 'Zahlungsarten');
		return { message: 'Zahlungsarten gespeichert.' };
	},

	stripe_test: async ({ locals }) => {
		requirePermission(locals, 'settings.manage');
		try {
			const stripe = await stripeClient();
			const bal = await stripe.balance.retrieve();
			const live = bal.livemode ? 'Live-Modus' : 'Testmodus';
			return { message: `Verbindung zu Stripe klappt (${live}).` };
		} catch (err) {
			return fail(400, { error: `Stripe: ${(err as Error).message}` });
		}
	},

	versand: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		const codes = f.getAll('code').map(String);
		for (const code of codes) {
			const price = parseEuro(f.get(`preis_${code}`));
			await db
				.update(shippingCountries)
				.set({
					active: checked(f.get(`aktiv_${code}`)),
					price: price ?? 0,
					freeFrom: parseEuro(f.get(`frei_${code}`)),
					vatRate: Math.round((Number(String(f.get(`ust_${code}`) ?? '0').replace(',', '.')) || 0) * 100)
				})
				.where(eq(shippingCountries.code, code));
		}
		await saveSettings('pickup', {
			enabled: checked(f.get('abholung')),
			address: str(f.get('abhol_adresse'), 200),
			note: str(f.get('abhol_hinweis'), 200),
			noteEn: str(f.get('abhol_hinweis_en'), 200)
		});
		await logAction(me.id, 'geändert', 'einstellungen', null, 'Versand');
		return { message: 'Versand gespeichert.' };
	},

	email: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		await saveSettings('mail', {
			host: str(f.get('host'), 120),
			port: Number(f.get('port')) || 587,
			secure: f.get('sicherheit') === 'ssl',
			user: str(f.get('benutzer'), 120),
			from: str(f.get('absender'), 120),
			fromName: str(f.get('absender_name'), 80),
			teamFallback: str(f.get('team'), 200)
		});
		const pw = String(f.get('passwort') ?? '');
		if (pw) await saveSecrets({ smtpPassword: pw });
		forgetTransport();
		await logAction(me.id, 'geändert', 'einstellungen', null, 'E-Mail');
		const problem = await verifySmtp();
		return problem ? { message: `Gespeichert, aber die Verbindung klappt noch nicht: ${problem}` } : { message: 'Gespeichert – Verbindung zum Mailserver klappt.' };
	},

	testmail: async ({ locals }) => {
		const me = requirePermission(locals, 'settings.manage');
		const s = await getSettings();
		const to = me.email || s.mail.teamFallback;
		if (!to) return fail(400, { error: 'Bitte in „Mein Konto“ eine E-Mail-Adresse hinterlegen.' });
		const ok = await sendMail(to, await teamNoticeMail('Test-E-Mail vom Shop', 'Wenn du das liest, funktioniert der E-Mail-Versand.', '/admin'), { template: 'test' });
		return ok ? { message: `Test-E-Mail an ${to} gesendet.` } : fail(400, { error: 'Senden fehlgeschlagen – Details im E-Mail-Protokoll unten.' });
	},

	haendler: async ({ locals, request }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		await saveSettings('dealers', { defaultDiscount: Math.min(90, Math.max(0, Number(f.get('rabatt')) || 0)), applicationsOpen: checked(f.get('anfragen')) });
		await saveSettings('dekor', { maxRevisions: Math.min(20, Math.max(0, Number(f.get('korrekturen')) || 0)) });
		await logAction(me.id, 'geändert', 'einstellungen', null, 'Händler & Dekore');
		return { message: 'Gespeichert.' };
	},

	sichern: async ({ locals }) => {
		requirePermission(locals, 'settings.manage');
		const name = await createBackup();
		return { message: `Sicherung ${name} erstellt` };
	},

	/** quelle = "stand:<Name>" (Liste am Server) oder "upload:<id>" (hochgeladene Datei) */
	wiederherstellen: async ({ locals, request, cookies }) => {
		const me = requirePermission(locals, 'settings.manage');
		const f = await request.formData();
		if (f.get('bestaetigt') !== 'ja') return fail(400, { error: 'Bitte bestätigen, dass der aktuelle Stand ersetzt wird.' });
		const quelle = str(f.get('quelle'), 80);
		const source = quelle.startsWith('stand:') ? { backup: quelle.slice(6) } : quelle.startsWith('upload:') ? { upload: quelle.slice(7) } : null;
		if (!source) return fail(400, { error: 'Unbekannte Sicherung.' });
		let result: Awaited<ReturnType<typeof restoreBackup>>;
		try {
			result = await restoreBackup(source);
		} catch (err) {
			if (err instanceof RestoreError) return fail(400, { error: err.message });
			console.error('[wiederherstellen]', err);
			return fail(500, { error: 'Die Wiederherstellung ist fehlgeschlagen. Details stehen im Server-Log.' });
		}
		const from = result.summary.stamp ? `vom ${formatBackupName(result.summary.stamp)}` : 'aus einer hochgeladenen Datei';
		await logAction(null, 'geändert', 'einstellungen', null, `Sicherung ${from} wiederhergestellt durch ${me.name}`);
		clearSessionCookie(cookies);
		redirect(303, `/admin/login?wiederhergestellt=${encodeURIComponent(result.safety)}`);
	}
};
