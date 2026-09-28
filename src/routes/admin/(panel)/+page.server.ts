import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { todayVienna } from '$lib/format';
import { can } from '$lib/permissions';
import { db } from '$lib/server/db';
import { dekorJobs, messages, orders, pageViews, payments, products, variants } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guard';
import { getSecrets } from '$lib/server/secrets';
import { companyGaps, getSettings, saveSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

function monthStart(): Date {
	const t = todayVienna();
	return new Date(`${t.slice(0, 8)}01T00:00:00`);
}

export const load: PageServerLoad = async ({ locals }) => {
	const me = requireUser(locals);
	const s = await getSettings();
	const secrets = await getSecrets();

	const from30 = new Date(Date.now() - 29 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
	const [recent, transfers, jobs, lowStock, unread, views, draftCount, activeCount] = await Promise.all([
		db
			.select({ id: orders.id, number: orders.number, createdAt: orders.createdAt, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, billing: orders.billingAddress })
			.from(orders)
			.orderBy(desc(orders.id))
			.limit(8)
			.all(),
		db
			.select({ id: orders.id, number: orders.number, createdAt: orders.createdAt, amountDue: orders.amountDue, billing: orders.billingAddress })
			.from(orders)
			.where(and(eq(orders.status, 'zahlung_offen'), eq(orders.paymentMethod, 'ueberweisung')))
			.orderBy(asc(orders.createdAt))
			.all(),
		db
			.select({ id: dekorJobs.id, title: dekorJobs.title, status: dekorJobs.status, type: dekorJobs.type, orderNumber: orders.number, updatedAt: dekorJobs.updatedAt, paymentStatus: orders.paymentStatus })
			.from(dekorJobs)
			.innerJoin(orders, eq(orders.id, dekorJobs.orderId))
			.where(inArray(dekorJobs.status, ['neu', 'in_gestaltung', 'aenderung_gewuenscht', 'freigegeben', 'in_produktion']))
			.orderBy(asc(dekorJobs.updatedAt))
			.limit(12)
			.all(),
		db
			.select({ productId: products.id, title: products.title, stock: variants.stock, values: variants.optionValues })
			.from(variants)
			.innerJoin(products, eq(products.id, variants.productId))
			.where(and(eq(products.stockMode, 'bestand'), eq(products.status, 'aktiv'), eq(variants.active, true), lte(variants.stock, 3)))
			.orderBy(asc(variants.stock))
			.limit(10)
			.all(),
		db
			.select({ orderId: messages.orderId, number: orders.number, n: sql<number>`count(*)` })
			.from(messages)
			.innerJoin(orders, eq(orders.id, messages.orderId))
			.where(and(eq(messages.author, 'kunde'), isNull(messages.readByTeamAt)))
			.groupBy(messages.orderId)
			.all(),
		db
			.select({ day: pageViews.day, n: sql<number>`sum(${pageViews.views})` })
			.from(pageViews)
			.where(gte(pageViews.day, from30))
			.groupBy(pageViews.day)
			.orderBy(asc(pageViews.day))
			.all(),
		db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.status, 'entwurf')).get(),
		db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.status, 'aktiv')).get()
	]);

	// Tage ohne Aufrufe auffüllen
	const byDay = new Map(views.map((v) => [v.day, Number(v.n)]));
	const series: { day: string; n: number }[] = [];
	for (let i = 29; i >= 0; i--) {
		const day = new Date(Date.now() - i * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
		series.push({ day, n: byDay.get(day) ?? 0 });
	}

	let finance: { month: number; monthOrders: number; today: number } | null = null;
	if (can(me.role, 'finance.view')) {
		const start = monthStart();
		const todayStart = new Date(`${todayVienna()}T00:00:00`);
		const [m, t, c] = await Promise.all([
			db.select({ n: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.status, 'bezahlt'), gte(payments.paidAt, start))).get(),
			db.select({ n: sql<number>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.status, 'bezahlt'), gte(payments.paidAt, todayStart))).get(),
			db
				.select({ n: sql<number>`count(*)` })
				.from(orders)
				.where(and(gte(orders.createdAt, start), sql`${orders.status} <> 'storniert'`))
				.get()
		]);
		finance = { month: Number(m?.n ?? 0), today: Number(t?.n ?? 0), monthOrders: Number(c?.n ?? 0) };
	}

	// Checkliste für den Start: manches erkennt das System selbst (auto), alles lässt sich von Hand abhaken
	const checks: { key: SetupKey; label: string; href: string; auto: boolean }[] = [
		{ key: 'firma', label: 'Firmendaten vollständig (Adresse, Firmenbuch, Bank)', href: '/admin/einstellungen', auto: companyGaps(s).length === 0 },
		{
			key: 'zahlung',
			label: 'Online-Zahlung eingerichtet (Stripe oder PayPal)',
			href: '/admin/einstellungen?tab=zahlung',
			auto: (s.payments.stripe.enabled && !!secrets.stripeSecretKey && !!secrets.stripeWebhookSecret) || (s.payments.paypal.enabled && !!secrets.paypalClientId)
		},
		{ key: 'email', label: 'E-Mail-Versand (SMTP) eingerichtet', href: '/admin/einstellungen?tab=email', auto: !!s.mail.host },
		{ key: 'versand', label: 'Versandländer und Preise geprüft', href: '/admin/einstellungen?tab=versand', auto: false },
		{ key: 'aufpreise', label: 'Aufpreise für Base & Finish festgelegt', href: '/admin/upgrades', auto: false },
		{ key: 'produkt', label: 'Erstes Produkt veröffentlicht', href: '/admin/produkte', auto: Number(activeCount?.n ?? 0) > 0 },
		{ key: 'rechtstexte', label: 'Rechtstexte geprüft (AGB, Widerruf, Datenschutz, Impressum)', href: '/admin/seiten', auto: false }
	];
	const setup = checks.map((c) => {
		const manual = s.setup.done.includes(c.key);
		return { ...c, manual, done: c.auto || manual };
	});
	const allDone = setup.every((c) => c.done);

	return {
		finance,
		recent,
		transfers: transfers.map((t) => ({ ...t, days: Math.floor((Date.now() - t.createdAt.getTime()) / 86_400_000), overdue: Date.now() - t.createdAt.getTime() > s.orders.transferDays * 86_400_000 })),
		jobs,
		lowStock,
		unread: unread.map((u) => ({ ...u, n: Number(u.n) })),
		views: series,
		drafts: Number(draftCount?.n ?? 0),
		// ist alles erledigt, lässt sich die Liste ausblenden; öffnet sich ein Punkt wieder, erscheint sie erneut
		setup: allDone && s.setup.hidden ? [] : setup,
		setupAllDone: allDone,
		canEditSetup: can(me.role, 'settings.manage')
	};
};

const SETUP_KEYS = ['firma', 'zahlung', 'email', 'versand', 'aufpreise', 'produkt', 'rechtstexte'] as const;
type SetupKey = (typeof SETUP_KEYS)[number];

export const actions: Actions = {
	/** Punkt der Start-Checkliste von Hand abhaken oder wieder öffnen */
	setup: async ({ request, locals }) => {
		const me = requireUser(locals);
		if (!can(me.role, 'settings.manage')) return fail(403, { error: 'Nur Admins können die Checkliste abhaken.' });
		const form = await request.formData();
		const s = await getSettings();
		if (form.get('ausblenden')) {
			await saveSettings('setup', { hidden: true });
			return { ok: true };
		}
		const key = String(form.get('punkt') ?? '') as SetupKey;
		if (!SETUP_KEYS.includes(key)) return fail(400, { error: 'Unbekannter Punkt.' });
		const done = new Set(s.setup.done);
		if (done.has(key)) done.delete(key);
		else done.add(key);
		await saveSettings('setup', { done: [...done], hidden: false });
		return { ok: true };
	}
};
