import { requireCustomer } from '$lib/server/customer-auth';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { teamNoticeMail } from '$lib/server/emails';
import { str } from '$lib/server/guard';
import { notifyTeam } from '$lib/server/notify';
import { getSettings } from '$lib/server/settings';
import { checkVatId, normalizeVatId } from '$lib/server/vies';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const c = (await db.select().from(customers).where(eq(customers.id, requireCustomer(locals).id)).get())!;
	const s = await getSettings();
	return { status: c.dealerStatus, company: c.company, vatId: c.vatId, open: s.dealers.applicationsOpen };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const s = await getSettings();
		if (!s.dealers.applicationsOpen) return fail(400, { error: L('Derzeit nehmen wir keine neuen Händler auf.', "We're not accepting new dealers at the moment.") });
		const form = await request.formData();
		const company = str(form.get('firma'), 120);
		const vatId = normalizeVatId(str(form.get('uid'), 20));
		const note = str(form.get('nachricht'), 2000);
		if (!company || !vatId) return fail(400, { error: L('Bitte Firma und UID-Nummer angeben.', 'Please enter company name and VAT ID.') });
		const valid = await checkVatId(vatId);
		const c = requireCustomer(locals);
		await db
			.update(customers)
			.set({ company, vatId, vatIdValid: valid, vatIdCheckedAt: valid === null ? null : new Date(), dealerStatus: 'angefragt', internalNote: note ? `Händleranfrage: ${note}` : '' })
			.where(eq(customers.id, c.id));
		void notifyTeam(
			teamNoticeMail(
				`Händleranfrage: ${company}`,
				`${c.firstName} ${c.lastName} (${c.email})\nUID: ${vatId} – ${valid === true ? 'laut VIES gültig' : valid === false ? 'laut VIES NICHT gültig' : 'VIES nicht erreichbar'}${note ? `\n\n${note}` : ''}`,
				`/admin/kunden/${c.id}`
			),
			{ title: 'Neue Händleranfrage', body: company, url: `/admin/kunden/${c.id}` }
		);
		return { sent: true };
	}
};
