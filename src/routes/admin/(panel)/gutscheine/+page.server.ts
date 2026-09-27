import { fail } from '@sveltejs/kit';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { parseEuro } from '$lib/admin-labels';
import { logAction } from '$lib/server/audit';
import { isEmail, normalizeEmail } from '$lib/server/customer-auth';
import { db } from '$lib/server/db';
import { categories, discountCodes, giftCards, giftCardTransactions, orders } from '$lib/server/db/schema';
import { giftCardMail } from '$lib/server/emails';
import { checked, idList, intOrNull, requirePermission, str } from '$lib/server/guard';
import { queueMail } from '$lib/server/mail';
import { giftCardCode } from '$lib/server/shop/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'shop.manage');
	const q = (url.searchParams.get('q') ?? '').trim().toUpperCase().slice(0, 40);
	const [cards, codes, cats] = await Promise.all([
		db
			.select({ card: giftCards, orderNumber: orders.number })
			.from(giftCards)
			.leftJoin(orders, eq(orders.id, giftCards.orderId))
			.where(q ? sql`upper(${giftCards.code}) LIKE ${`%${q}%`} OR upper(${giftCards.recipientEmail}) LIKE ${`%${q}%`}` : undefined)
			.orderBy(desc(giftCards.id))
			.limit(100)
			.all(),
		db.select().from(discountCodes).orderBy(desc(discountCodes.active), desc(discountCodes.id)).all(),
		db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder)).all()
	]);
	return { cards: cards.map((c) => ({ ...c.card, orderNumber: c.orderNumber })), codes, categories: cats, q };
};

export const actions: Actions = {
	gutschein: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const value = parseEuro(f.get('wert'));
		if (!value || value <= 0) return fail(400, { error: 'Bitte einen Wert eingeben.' });
		const email = normalizeEmail(str(f.get('email'), 200));
		if (email && !isEmail(email)) return fail(400, { error: 'Die E-Mail-Adresse stimmt nicht.' });
		let card = null;
		for (let i = 0; i < 5 && !card; i++) {
			try {
				card = await db
					.insert(giftCards)
					.values({
						code: giftCardCode(),
						initialValue: value,
						balance: value,
						recipientName: str(f.get('name'), 80),
						recipientEmail: email,
						message: str(f.get('nachricht'), 500),
						note: str(f.get('notiz'), 300),
						sentAt: email && checked(f.get('senden')) ? new Date() : null
					})
					.returning()
					.get();
			} catch {
				/* Code vergeben → neu versuchen */
			}
		}
		if (!card) return fail(500, { error: 'Es konnte kein Code erzeugt werden.' });
		await db.insert(giftCardTransactions).values({ giftCardId: card.id, amount: value, note: `Ausgestellt von ${me.name}` });
		if (email && checked(f.get('senden'))) queueMail(email, giftCardMail(card, f.get('sprache') === 'en' ? 'en' : 'de', ''), { template: 'gutschein' });
		await logAction(me.id, 'erstellt', 'gutschein', card.id, card.code);
		return { message: `Gutschein ${card.code} ausgestellt.`, created: card.code };
	},
	guthaben: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = Number(f.get('id'));
		const delta = parseEuro(f.get('betrag'));
		const card = await db.select().from(giftCards).where(eq(giftCards.id, id)).get();
		if (!card || delta == null || delta === 0) return fail(400, { error: 'Bitte einen Betrag (+ oder −) eingeben.' });
		if (card.balance + delta < 0) return fail(400, { error: 'Das Guthaben kann nicht negativ werden.' });
		await db.update(giftCards).set({ balance: card.balance + delta }).where(eq(giftCards.id, id));
		await db.insert(giftCardTransactions).values({ giftCardId: id, amount: delta, note: str(f.get('grund'), 200) || `Korrektur von ${me.name}` });
		await logAction(me.id, 'geändert', 'gutschein', id, `${card.code}: ${delta / 100} €`);
		return { message: 'Guthaben angepasst.' };
	},
	aktiv: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = Number(f.get('id'));
		await db
			.update(giftCards)
			.set({ active: f.get('aktiv') === '1' })
			.where(eq(giftCards.id, id));
		await logAction(me.id, 'geändert', 'gutschein', id, f.get('aktiv') === '1' ? 'aktiviert' : 'gesperrt');
		return { message: 'Gespeichert.' };
	},
	code: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const f = await request.formData();
		const id = intOrNull(f.get('id'));
		const code = str(f.get('code'), 40).toUpperCase().replace(/\s/g, '');
		if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return fail(400, { error: 'Code: 3–40 Zeichen, nur Buchstaben, Zahlen, - und _.' });
		const dup = await db
			.select({ id: discountCodes.id })
			.from(discountCodes)
			.where(sql`upper(${discountCodes.code}) = ${code}`)
			.get();
		if (dup && dup.id !== id) return fail(400, { error: 'Diesen Code gibt es schon.' });
		const kind = (['prozent', 'betrag', 'versandfrei'].includes(String(f.get('art'))) ? f.get('art') : 'prozent') as 'prozent' | 'betrag' | 'versandfrei';
		const value = kind === 'prozent' ? Math.min(100, Math.max(0, Number(f.get('wert')) || 0)) : kind === 'betrag' ? (parseEuro(f.get('wert')) ?? 0) : 0;
		if (kind !== 'versandfrei' && value <= 0) return fail(400, { error: 'Bitte einen Rabatt eingeben.' });
		const day = (k: string) => {
			const v = str(f.get(k), 10);
			return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
		};
		const values = {
			code,
			kind,
			value,
			minOrder: parseEuro(f.get('mindest')),
			validFrom: day('ab'),
			validUntil: day('bis'),
			maxUses: intOrNull(f.get('max')),
			oncePerCustomer: checked(f.get('einmal')),
			categoryIds: idList(f, 'kategorien'),
			dealersAllowed: checked(f.get('haendler')),
			active: checked(f.get('aktiv')),
			note: str(f.get('notiz'), 300)
		};
		if (id) await db.update(discountCodes).set(values).where(eq(discountCodes.id, id));
		else await db.insert(discountCodes).values(values);
		await logAction(me.id, id ? 'geändert' : 'erstellt', 'rabatt', id, code);
		return { message: 'Rabattcode gespeichert.' };
	},
	code_loeschen: async ({ locals, request }) => {
		const me = requirePermission(locals, 'shop.manage');
		const id = Number((await request.formData()).get('id'));
		const used = await db.select({ n: discountCodes.usedCount }).from(discountCodes).where(eq(discountCodes.id, id)).get();
		// Eingelöste Codes nur deaktivieren, damit die Bestellungen nachvollziehbar bleiben
		if ((used?.n ?? 0) > 0) await db.update(discountCodes).set({ active: false }).where(eq(discountCodes.id, id));
		else await db.delete(discountCodes).where(eq(discountCodes.id, id));
		await logAction(me.id, 'gelöscht', 'rabatt', id, `Rabattcode ${id}`);
		return { message: (used?.n ?? 0) > 0 ? 'Der Code wurde schon verwendet und ist jetzt deaktiviert.' : 'Rabattcode gelöscht.' };
	}
};
