import { fail } from '@sveltejs/kit';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { isEmail, normalizeEmail } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { inquiries } from '$lib/server/db/schema';
import { teamInquiryMail } from '$lib/server/emails';
import { checked, str } from '$lib/server/guard';
import { notifyTeam } from '$lib/server/notify';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const c = locals.customer;
	return { defaults: { name: c ? `${c.firstName} ${c.lastName}`.trim() : '', email: c?.email ?? '', phone: c?.phone ?? '' }, subject: url.searchParams.get('betreff') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const form = await request.formData();
		// Unsichtbares Feld – nur Bots füllen es aus
		if (str(form.get('website'), 200)) return { sent: true };
		const values = {
			name: str(form.get('name'), 120),
			email: normalizeEmail(str(form.get('email'), 200)),
			phone: str(form.get('telefon'), 40),
			subject: str(form.get('betreff'), 150),
			message: str(form.get('nachricht'), 5000)
		};
		if (!values.name || !isEmail(values.email) || values.message.length < 5) return fail(400, { values, error: L('Bitte Name, E-Mail und Nachricht angeben.', 'Please enter name, email and message.') });
		if (!checked(form.get('datenschutz'))) return fail(400, { values, error: L('Bitte bestätige die Datenschutzerklärung.', 'Please accept the privacy policy.') });
		const key = `anfrage:${getClientAddress()}`;
		if (isRateLimited(key, 5, 60 * 60_000)) return fail(429, { values, error: L('Zu viele Anfragen. Bitte später erneut versuchen oder per E-Mail melden.', 'Too many requests. Please try later or email us.') });
		registerFailure(key, 60 * 60_000);
		const inq = await db
			.insert(inquiries)
			.values({ ...values, locale: locals.locale })
			.returning()
			.get();
		void notifyTeam(teamInquiryMail(inq), { title: 'Neue Anfrage', body: `${inq.name}: ${inq.subject || inq.message.slice(0, 80)}`, url: '/admin/anfragen' });
		return { sent: true };
	}
};
