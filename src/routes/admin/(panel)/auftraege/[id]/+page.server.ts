import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DEKOR_STATUS, type DekorStatus } from '$lib/shop-types';
import { euro, parseEuro } from '$lib/admin-labels';
import { logAction } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { dekorJobs, dekorProofs, files, orderItems, orders, payments, shippingCountries, users } from '$lib/server/db/schema';
import { requirePermission, str } from '$lib/server/guard';
import { fileRef } from '$lib/server/files';
import { getSettings } from '$lib/server/settings';
import { remainingAmount, requestRemainingPayment, sendProof, setJobStatus } from '$lib/server/shop/dekor';
import type { Actions, PageServerLoad } from './$types';

async function getJob(id: string) {
	const job = await db.select().from(dekorJobs).where(eq(dekorJobs.id, Number(id))).get();
	if (!job) error(404, 'Auftrag nicht gefunden');
	return job;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'shop.manage');
	const job = await getJob(params.id);
	const [order, item, proofs, team, pays, fileRows] = await Promise.all([
		db.select().from(orders).where(eq(orders.id, job.orderId)).get(),
		db.select().from(orderItems).where(eq(orderItems.id, job.orderItemId)).get(),
		db.select().from(dekorProofs).where(eq(dekorProofs.jobId, job.id)).orderBy(desc(dekorProofs.version)).all(),
		db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)).all(),
		db.select().from(payments).where(eq(payments.dekorJobId, job.id)).orderBy(desc(payments.id)).all(),
		db.select().from(files).where(eq(files.orderId, job.orderId)).all()
	]);
	if (!order || !item) error(404);
	const s = await getSettings();
	const country = order.shippingCountry ? await db.select().from(shippingCountries).where(eq(shippingCountries.code, order.shippingCountry)).get() : null;
	const fileMap = Object.fromEntries(fileRows.map((f) => [f.id, fileRef(f)]));
	return {
		job,
		order: { id: order.id, number: order.number, email: order.email, billing: order.billingAddress, paymentStatus: order.paymentStatus, status: order.status, shippingMethod: order.shippingMethod, taxCase: order.taxCase },
		item: { title: item.title, variantTitle: item.variantTitle, config: item.config },
		proofs: proofs.map((p) => ({ ...p, files: p.fileIds.map((id) => fileMap[id]).filter(Boolean) })),
		files: fileMap,
		team,
		payments: pays,
		suggestedShipping: order.shippingMethod === 'versand' ? (country?.price ?? 0) : 0,
		maxRevisions: s.dekor.maxRevisions,
		preview: job.finalPrice != null ? await remainingAmount(job, job.finalPrice, job.shippingAmount ?? 0) : null
	};
};

export const actions: Actions = {
	entwurf: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const job = await getJob(params.id);
		const f = await request.formData();
		const ids = String(f.get('dateien') ?? '')
			.split(',')
			.map(Number)
			.filter((n) => n > 0);
		if (!ids.length) return fail(400, { error: 'Bitte mindestens eine Datei für den Entwurf hochladen.' });
		await db.update(files).set({ orderId: job.orderId }).where(and(inArray(files.id, ids), eq(files.source, 'team')));
		await sendProof(job.id, me.id, ids, str(f.get('nachricht'), 4000));
		await logAction(me.id, 'geändert', 'auftrag', job.id, `Entwurf gesendet: ${job.title}`);
		return { message: 'Entwurf gesendet – der Kunde bekommt eine E-Mail.' };
	},
	preis: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const job = await getJob(params.id);
		const f = await request.formData();
		const finalPrice = parseEuro(f.get('endpreis'));
		const shipping = parseEuro(f.get('versand')) ?? 0;
		if (finalPrice == null || finalPrice < job.depositAmount) return fail(400, { error: `Der Endpreis muss mindestens so hoch wie die Anzahlung (${euro(job.depositAmount)}) sein.` });
		if (f.get('anfordern') === '1') {
			if (!['freigegeben', 'restzahlung_offen'].includes(job.status)) return fail(400, { error: 'Die Restzahlung wird nach der Freigabe durch den Kunden angefordert.' });
			const p = await requestRemainingPayment(job.id, finalPrice, shipping);
			await logAction(me.id, 'geändert', 'auftrag', job.id, `Restzahlung angefordert: ${job.title}`);
			return { message: p.amount === 0 ? 'Kein Restbetrag – Auftrag ist in Produktion.' : `Restzahlung über ${euro(p.amount)} angefordert. Der Kunde bekommt einen Zahlungslink.` };
		}
		await db.update(dekorJobs).set({ finalPrice, shippingAmount: shipping || null }).where(eq(dekorJobs.id, job.id));
		return { message: 'Endpreis gespeichert. Nach der Freigabe wird die Restzahlung automatisch angefordert.' };
	},
	status: async ({ locals, params, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const job = await getJob(params.id);
		const s = str((await request.formData()).get('status'), 30) as DekorStatus;
		if (!DEKOR_STATUS.includes(s)) return fail(400, { error: 'Unbekannter Status.' });
		await setJobStatus(job.id, s);
		await logAction(me.id, 'geändert', 'auftrag', job.id, `Status ${s}: ${job.title}`);
		return { message: 'Status geändert.' };
	},
	details: async ({ locals, params, request }) => {
		requirePermission(locals, 'shop.manage');
		const job = await getJob(params.id);
		const f = await request.formData();
		const assignee = Number(f.get('zustaendig')) || null;
		const due = str(f.get('termin'), 10);
		await db
			.update(dekorJobs)
			.set({ assigneeId: assignee, dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, internalNote: str(f.get('notiz'), 4000) })
			.where(eq(dekorJobs.id, job.id));
		return { message: 'Gespeichert.' };
	}
};
