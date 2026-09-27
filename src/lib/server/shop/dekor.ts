import { and, desc, eq, sql } from 'drizzle-orm';
import type { DekorStatus } from '$lib/shop-types';
import { db } from '../db';
import { dekorJobs, dekorProofs, messages, orders, payments, type DekorJob, type Payment } from '../db/schema';
import { paymentReceivedMail, proofReadyMail, remainingPaymentMail, teamNoticeMail } from '../emails';
import { queueMail } from '../mail';
import { notifyTeam } from '../notify';
import { getSettings } from '../settings';
import { createFinalInvoice } from './invoices';
import { newToken } from './orders';
import { netOf } from './pricing';

/**
 * Ablauf eines Dekor-Auftrags:
 *   neu → in_gestaltung → entwurf_gesendet ⇄ aenderung_gewuenscht → freigegeben
 *   Full Custom: → restzahlung_offen → in_produktion → versendet → abgeschlossen
 *   Semi Custom / Reprint (schon voll bezahlt): freigegeben bzw. neu → in_produktion → …
 */

export const DEKOR_STATUS_LABELS: Record<DekorStatus, { de: string; en: string }> = {
	neu: { de: 'Neu', en: 'Received' },
	in_gestaltung: { de: 'In Gestaltung', en: 'Being designed' },
	entwurf_gesendet: { de: 'Entwurf beim Kunden', en: 'Design ready for review' },
	aenderung_gewuenscht: { de: 'Änderung gewünscht', en: 'Changes requested' },
	freigegeben: { de: 'Freigegeben', en: 'Approved' },
	restzahlung_offen: { de: 'Restzahlung offen', en: 'Remaining payment due' },
	in_produktion: { de: 'In Produktion', en: 'In production' },
	versendet: { de: 'Versendet', en: 'Shipped' },
	abgeschlossen: { de: 'Abgeschlossen', en: 'Completed' },
	storniert: { de: 'Storniert', en: 'Cancelled' }
};

/** Spalten des Boards im Admin */
export const BOARD_COLUMNS: { key: string; label: string; statuses: DekorStatus[] }[] = [
	{ key: 'neu', label: 'Neu', statuses: ['neu'] },
	{ key: 'gestaltung', label: 'Gestaltung', statuses: ['in_gestaltung', 'aenderung_gewuenscht'] },
	{ key: 'kunde', label: 'Wartet auf Kunde', statuses: ['entwurf_gesendet', 'freigegeben', 'restzahlung_offen'] },
	{ key: 'produktion', label: 'Produktion', statuses: ['in_produktion'] },
	{ key: 'fertig', label: 'Versendet', statuses: ['versendet'] }
];

async function orderOf(job: DekorJob) {
	return (await db.select().from(orders).where(eq(orders.id, job.orderId)).get())!;
}

export async function getJob(id: number) {
	return db.select().from(dekorJobs).where(eq(dekorJobs.id, id)).get();
}

/** Team lädt einen Entwurf hoch → Kunde bekommt eine Mail */
export async function sendProof(jobId: number, userId: number, fileIds: number[], message: string) {
	const job = await getJob(jobId);
	if (!job) throw new Error('Auftrag nicht gefunden');
	const last = await db.select({ v: dekorProofs.version }).from(dekorProofs).where(eq(dekorProofs.jobId, jobId)).orderBy(desc(dekorProofs.version)).get();
	const version = (last?.v ?? 0) + 1;
	await db
		.update(dekorProofs)
		.set({ status: 'ersetzt' })
		.where(and(eq(dekorProofs.jobId, jobId), eq(dekorProofs.status, 'offen')));
	await db.insert(dekorProofs).values({ jobId, version, message, fileIds, createdById: userId });
	await db.update(dekorJobs).set({ status: 'entwurf_gesendet' }).where(eq(dekorJobs.id, jobId));
	const order = await orderOf(job);
	queueMail(order.email, proofReadyMail(order, job, version, message), { template: 'entwurf', orderId: order.id });
}

export type ProofDecision = 'freigegeben' | 'aenderung';

/** Kunde gibt frei oder wünscht Änderungen */
export async function decideProof(jobId: number, proofId: number, decision: ProofDecision, note: string): Promise<'ok' | 'not_open'> {
	const job = await getJob(jobId);
	const proof = await db
		.select()
		.from(dekorProofs)
		.where(and(eq(dekorProofs.id, proofId), eq(dekorProofs.jobId, jobId)))
		.get();
	if (!job || !proof || proof.status !== 'offen' || job.status !== 'entwurf_gesendet') return 'not_open';
	await db.update(dekorProofs).set({ status: decision, customerNote: note, decidedAt: new Date() }).where(eq(dekorProofs.id, proofId));
	const order = await orderOf(job);
	if (decision === 'aenderung') {
		await db
			.update(dekorJobs)
			.set({ status: 'aenderung_gewuenscht', revisions: sql`${dekorJobs.revisions} + 1` })
			.where(eq(dekorJobs.id, jobId));
		if (note) await db.insert(messages).values({ orderId: order.id, author: 'kunde', body: `Änderungswunsch zu Entwurf ${proof.version}:\n${note}` });
		void notifyTeam(
			teamNoticeMail(`Änderungswunsch: ${job.title} (Bestellung ${order.number})`, note || 'Der Kunde wünscht Änderungen am Entwurf.', `/admin/auftraege/${job.id}`),
			{ title: `Änderungswunsch · ${order.number}`, body: note.slice(0, 120) || job.title, url: `/admin/auftraege/${job.id}` },
			order.id
		);
		return 'ok';
	}
	// Freigabe
	const next: DekorStatus = job.type === 'full_custom' ? 'freigegeben' : 'in_produktion';
	await db.update(dekorJobs).set({ status: next, approvedAt: new Date() }).where(eq(dekorJobs.id, jobId));
	if (note) await db.insert(messages).values({ orderId: order.id, author: 'kunde', body: `Freigabe von Entwurf ${proof.version}:\n${note}` });
	const fresh = (await getJob(jobId))!;
	// Endpreis schon bekannt → Restzahlung gleich anfordern
	if (fresh.type === 'full_custom' && fresh.finalPrice != null) await requestRemainingPayment(fresh.id, fresh.finalPrice, fresh.shippingAmount ?? 0);
	void notifyTeam(
		teamNoticeMail(
			`Entwurf freigegeben: ${job.title} (Bestellung ${order.number})`,
			fresh.type === 'full_custom' && fresh.finalPrice == null ? 'Bitte Endpreis eintragen und die Restzahlung anfordern.' : 'Der Kunde hat den Entwurf freigegeben.',
			`/admin/auftraege/${job.id}`
		),
		{ title: `Freigegeben · ${order.number}`, body: job.title, url: `/admin/auftraege/${job.id}` },
		order.id
	);
	return 'ok';
}

/** Offener Betrag = Endpreis + Versand – Anzahlung (bei Reverse Charge/Export netto) */
export async function remainingAmount(job: DekorJob, finalPrice: number, shipping: number) {
	const order = await orderOf(job);
	const s = await getSettings();
	const net = order.taxCase === 'reverse_charge' || order.taxCase === 'export';
	const conv = (g: number) => (net ? netOf(g, s.tax.standardRate) : g);
	return Math.max(0, conv(finalPrice) + conv(shipping) - job.depositAmount);
}

/** Restzahlung anlegen und den Kunden per Mail bitten, zu bezahlen */
export async function requestRemainingPayment(jobId: number, finalPrice: number, shipping: number): Promise<Payment> {
	const job = (await getJob(jobId))!;
	const amount = await remainingAmount(job, finalPrice, shipping);
	// Eine noch offene Restzahlung ersetzen
	await db
		.update(payments)
		.set({ status: 'abgebrochen' })
		.where(and(eq(payments.dekorJobId, jobId), eq(payments.status, 'offen')));
	await db.update(dekorJobs).set({ finalPrice, shippingAmount: shipping || null, status: 'restzahlung_offen' }).where(eq(dekorJobs.id, jobId));
	const payment = await db
		.insert(payments)
		.values({ orderId: job.orderId, dekorJobId: jobId, purpose: 'restzahlung', method: 'offen', amount, token: newToken() })
		.returning()
		.get();
	if (amount === 0) {
		const { markPaymentPaid } = await import('./orders');
		await markPaymentPaid(payment.id);
		return payment;
	}
	const order = await orderOf(job);
	queueMail(order.email, remainingPaymentMail(order, (await getJob(jobId))!, payment), { template: 'restzahlung', orderId: order.id });
	return payment;
}

export async function afterRemainingPaid(payment: Payment) {
	if (!payment.dekorJobId) return;
	const job = await getJob(payment.dekorJobId);
	if (!job) return;
	await db.update(dekorJobs).set({ status: 'in_produktion' }).where(eq(dekorJobs.id, job.id));
	const order = await orderOf(job);
	try {
		await createFinalInvoice(order, job, payment);
	} catch (err) {
		console.error('[schlussrechnung]', err);
	}
	queueMail(order.email, paymentReceivedMail(order, payment.amount, 'restzahlung'), { template: 'zahlung', orderId: order.id });
	void notifyTeam(
		teamNoticeMail(`Restzahlung eingegangen: ${job.title}`, `Bestellung ${order.number} – ab in die Produktion.`, `/admin/auftraege/${job.id}`),
		{ title: `Restzahlung da · ${order.number}`, body: job.title, url: `/admin/auftraege/${job.id}` },
		order.id
	);
}

export async function setJobStatus(jobId: number, status: DekorStatus) {
	await db.update(dekorJobs).set({ status }).where(eq(dekorJobs.id, jobId));
}
