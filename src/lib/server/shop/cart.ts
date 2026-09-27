import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { pick } from '$lib/i18n.svelte';
import type { MediaRef } from '$lib/media';
import type { LineConfigSnapshot, Locale } from '$lib/shop-types';
import type { SessionCustomer } from '../customer-auth';
import { db } from '../db';
import { cartItems, carts, discountCodes, discountRedemptions, files, giftCards, shippingCountries, type DiscountCode, type ShippingCountry } from '../db/schema';
import type { ShopSettings } from '../settings';
import { productLoader, resolveLine, todayIso, type FullProduct, type PriceContext } from './catalog';
import { computeTotals, type PriceLine, type Totals } from './pricing';

export const CART_COOKIE = 'byb_warenkorb';
const CART_TTL_DAYS = 60;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Warenkorb-ID aus dem Cookie; mit create=true wird bei Bedarf ein neuer angelegt */
export async function cartIdFrom(cookies: Cookies, create: boolean, customerId: number | null = null): Promise<string | null> {
	const token = cookies.get(CART_COOKIE);
	if (token && /^[A-Za-z0-9_-]{30,60}$/.test(token)) {
		const id = sha256(token);
		const exists = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, id)).get();
		if (exists) return id;
	}
	if (!create) return null;
	const fresh = randomBytes(24).toString('base64url');
	const id = sha256(fresh);
	await db.insert(carts).values({ id, customerId });
	cookies.set(CART_COOKIE, fresh, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: CART_TTL_DAYS * 86400 });
	return id;
}

export function clearCartCookie(cookies: Cookies) {
	cookies.delete(CART_COOKIE, { path: '/' });
}

export function dealerDiscountOf(customer: SessionCustomer | null, s: ShopSettings): number | null {
	if (!customer || customer.dealerStatus !== 'freigegeben') return null;
	return customer.dealerDiscount ?? s.dealers.defaultDiscount;
}

/* ================================================================ Ansicht */

export interface CartLine {
	id: number;
	productId: number;
	variantId: number;
	slug: string;
	title: string;
	variantTitle: string;
	kind: FullProduct['product']['kind'];
	dekorType: FullProduct['product']['dekorType'];
	isDeposit: boolean;
	image: MediaRef | null;
	quantity: number;
	unitPrice: number;
	listUnitPrice: number;
	lineTotal: number;
	snapshot: LineConfigSnapshot;
	/** Hinweis, wenn die Zeile so nicht mehr bestellbar ist */
	problem: string | null;
	limit: number | null;
	fileIds: number[];
}

export interface CartView {
	id: string | null;
	lines: CartLine[];
	count: number;
	country: string;
	discountCode: string | null;
	discountMessage: string | null;
	giftCards: { code: string; balance: number; used: number }[];
	totals: Totals;
	/** Mindestens ein Dekor (personalisiert → kein Rücktrittsrecht) */
	hasPersonalized: boolean;
	onlyDigital: boolean;
	/** Es wird (jetzt oder später) etwas geliefert – auch bei Anzahlungen für Full Custom */
	needsDelivery: boolean;
	canCheckout: boolean;
	dealer: boolean;
}

export interface CartContext {
	customer: SessionCustomer | null;
	locale: Locale;
	settings: ShopSettings;
	/** Überschreibt das Land aus dem Warenkorb (Kasse: Lieferadresse) */
	country?: string;
	shippingMethod?: 'versand' | 'abholung';
	/** UID in der Kasse eingegeben und geprüft */
	validVatId?: boolean;
	/** Für „einmal pro Kunde“ */
	email?: string | null;
}

export async function activeCountries(): Promise<ShippingCountry[]> {
	return db.select().from(shippingCountries).where(eq(shippingCountries.active, true)).orderBy(asc(shippingCountries.sortOrder), asc(shippingCountries.name)).all();
}

export async function loadCart(cartId: string | null, ctx: CartContext): Promise<CartView> {
	const L = (de: string, en: string) => (ctx.locale === 'en' ? en : de);
	const cart = cartId ? await db.select().from(carts).where(eq(carts.id, cartId)).get() : null;
	const items = cart ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id)).orderBy(asc(cartItems.id)).all() : [];
	const dealerDiscount = dealerDiscountOf(ctx.customer, ctx.settings);
	const pctx: PriceContext = { dealerDiscount, locale: ctx.locale };
	const load = productLoader();

	// Nur Dateien dieses Warenkorbs dürfen an Zeilen hängen
	const ownFiles = cart
		? new Set((await db.select({ id: files.id }).from(files).where(eq(files.cartId, cart.id)).all()).map((f) => f.id))
		: new Set<number>();

	const lines: CartLine[] = [];
	const priceLines: PriceLine[] = [];
	for (const item of items) {
		const fp = await load(item.productId);
		if (!fp) continue;
		const r = resolveLine(fp, item.variantId, item.config, pctx, ownFiles);
		const { product } = fp;
		let problem: string | null = null;
		if (product.status !== 'aktiv') problem = L('Nicht mehr erhältlich', 'No longer available');
		else if (Object.keys(r.errors).length) problem = L('Bitte neu konfigurieren', 'Please configure again');
		else if (r.limit === 0) problem = L('Ausverkauft', 'Sold out');
		else if (r.limit != null && item.quantity > r.limit) problem = L(`Nur noch ${r.limit} Stück verfügbar`, `Only ${r.limit} left`);
		const isDeposit = product.dekorType === 'full_custom';
		lines.push({
			id: item.id,
			productId: product.id,
			variantId: item.variantId,
			slug: product.slug,
			title: pick(ctx.locale, product.title, product.titleEn),
			variantTitle: r.variantTitle,
			kind: product.kind,
			dekorType: product.dekorType,
			isDeposit,
			image: fp.images[0] ?? null,
			quantity: item.quantity,
			unitPrice: r.unitPrice,
			listUnitPrice: r.listUnitPrice,
			lineTotal: r.unitPrice * item.quantity,
			snapshot: r.snapshot,
			problem,
			limit: r.limit,
			fileIds: r.fileIds
		});
		priceLines.push({
			key: item.id,
			unitPrice: r.unitPrice,
			quantity: item.quantity,
			taxable: product.kind !== 'gutschein',
			discountable: product.kind !== 'gutschein' && !isDeposit,
			categoryIds: fp.categoryIds,
			requiresShipping: product.kind !== 'gutschein' && !isDeposit && product.requiresShipping
		});
	}

	/* Land und Versand */
	const countries = await activeCountries();
	const wanted = (ctx.country ?? cart?.country ?? 'AT').toUpperCase();
	const country = countries.find((c) => c.code === wanted) ?? countries.find((c) => c.code === 'AT') ?? countries[0] ?? null;
	const allCountries = country ? null : await db.select().from(shippingCountries).where(eq(shippingCountries.code, wanted)).get();
	const countryRow = country ?? allCountries ?? null;

	/* Rabattcode */
	let discountMessage: string | null = null;
	let rule: DiscountCode | null = null;
	if (cart?.discountCode) {
		const check = await checkDiscountCode(cart.discountCode, { dealer: dealerDiscount != null, email: ctx.email ?? ctx.customer?.email ?? null });
		if (check.ok) rule = check.code;
		else discountMessage = discountErrorText(check.reason, ctx.locale);
	}

	/* Gutscheine */
	const codes = cart?.giftCardCodes ?? [];
	const cards = codes.length ? await db.select().from(giftCards).where(and(inArray(giftCards.code, codes), eq(giftCards.active, true))).all() : [];
	const cardList = codes.map((code) => cards.find((c) => c.code === code)).filter((c): c is NonNullable<typeof c> => !!c && c.balance > 0);

	const totals = computeTotals({
		lines: priceLines,
		shipping: {
			method: ctx.shippingMethod ?? 'versand',
			price: countryRow?.price ?? 0,
			freeFrom: countryRow?.freeFrom ?? null
		},
		discount: rule ? { kind: rule.kind, value: rule.value, categoryIds: rule.categoryIds, minOrder: rule.minOrder } : null,
		tax: {
			mode: ctx.settings.tax.mode,
			homeRate: ctx.settings.tax.standardRate,
			country: ctx.shippingMethod === 'abholung' ? 'AT' : (countryRow?.code ?? 'AT'),
			countryEu: ctx.shippingMethod === 'abholung' ? true : (countryRow?.eu ?? true),
			countryRate: countryRow?.vatRate ?? 0,
			oss: ctx.settings.tax.oss,
			validVatId: !!ctx.validVatId
		},
		giftCardBalances: cardList.map((c) => c.balance)
	});
	if (rule && totals.discountError) {
		discountMessage = discountErrorText(totals.discountError, ctx.locale, rule);
	}
	// Preise der Zeilen wie berechnet (bei Reverse Charge/Export netto)
	totals.lines.forEach((pl, i) => {
		lines[i].unitPrice = pl.unitPrice;
		lines[i].lineTotal = pl.lineTotal;
	});

	return {
		id: cart?.id ?? null,
		lines,
		count: lines.reduce((a, l) => a + l.quantity, 0),
		country: countryRow?.code ?? 'AT',
		discountCode: cart?.discountCode ?? null,
		discountMessage,
		giftCards: cardList.map((c, i) => ({ code: c.code, balance: c.balance, used: totals.giftCards[i] ?? 0 })),
		totals,
		hasPersonalized: lines.some((l) => l.kind === 'dekor'),
		onlyDigital: lines.length > 0 && lines.every((l) => l.kind === 'gutschein' || l.isDeposit),
		needsDelivery: lines.some((l) => l.kind !== 'gutschein'),
		canCheckout: lines.length > 0 && lines.every((l) => !l.problem),
		dealer: dealerDiscount != null
	};
}

/* ================================================================ Rabattcodes */

type DiscountCheck = { ok: true; code: DiscountCode } | { ok: false; reason: 'unknown' | 'expired' | 'used_up' | 'already_used' | 'not_for_dealers' };

export async function checkDiscountCode(input: string, opts: { dealer: boolean; email: string | null }): Promise<DiscountCheck> {
	const code = await db
		.select()
		.from(discountCodes)
		.where(sql`upper(${discountCodes.code}) = ${input.trim().toUpperCase()}`)
		.get();
	if (!code || !code.active) return { ok: false, reason: 'unknown' };
	const today = todayIso();
	if ((code.validFrom && today < code.validFrom) || (code.validUntil && today > code.validUntil)) return { ok: false, reason: 'expired' };
	if (code.maxUses != null && code.usedCount >= code.maxUses) return { ok: false, reason: 'used_up' };
	if (opts.dealer && !code.dealersAllowed) return { ok: false, reason: 'not_for_dealers' };
	if (code.oncePerCustomer && opts.email) {
		const used = await db
			.select({ id: discountRedemptions.id })
			.from(discountRedemptions)
			.where(and(eq(discountRedemptions.codeId, code.id), sql`lower(${discountRedemptions.email}) = ${opts.email.toLowerCase()}`))
			.get();
		if (used) return { ok: false, reason: 'already_used' };
	}
	return { ok: true, code };
}

function discountErrorText(reason: string, locale: Locale, rule?: DiscountCode): string {
	const L = (de: string, en: string) => (locale === 'en' ? en : de);
	switch (reason) {
		case 'expired':
			return L('Dieser Code ist nicht (mehr) gültig.', 'This code is not valid (anymore).');
		case 'used_up':
			return L('Dieser Code wurde bereits zu oft eingelöst.', 'This code has reached its usage limit.');
		case 'already_used':
			return L('Du hast diesen Code schon verwendet.', 'You have already used this code.');
		case 'not_for_dealers':
			return L('Dieser Code gilt nicht zusätzlich zu Händlerpreisen.', 'This code cannot be combined with dealer prices.');
		case 'min_order':
			return L(
				`Der Code gilt ab einem Bestellwert von ${((rule?.minOrder ?? 0) / 100).toFixed(2).replace('.', ',')} €.`,
				`The code requires a minimum order of €${((rule?.minOrder ?? 0) / 100).toFixed(2)}.`
			);
		case 'no_match':
			return L('Der Code gilt für keinen Artikel im Warenkorb.', 'The code does not apply to any item in your cart.');
		default:
			return L('Diesen Code kennen wir nicht.', "We don't know this code.");
	}
}

/* ================================================================ Aufräumen */

export async function purgeOldCarts() {
	const cutoff = new Date(Date.now() - CART_TTL_DAYS * 86_400_000);
	await db.delete(carts).where(lt(carts.updatedAt, cutoff));
}

export async function touchCart(cartId: string, patch: Partial<typeof carts.$inferInsert> = {}) {
	await db
		.update(carts)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(carts.id, cartId));
}
