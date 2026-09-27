import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { cartItems, carts, giftCards } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/settings';
import { activeCountries, cartIdFrom, checkDiscountCode, dealerDiscountOf, loadCart, touchCart } from '$lib/server/shop/cart';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const s = await getSettings();
	const cartId = await cartIdFrom(cookies, false);
	const [cart, countries] = await Promise.all([loadCart(cartId, { customer: locals.customer, locale: locals.locale, settings: s }), activeCountries()]);
	return {
		view: cart,
		countries: countries.map((c) => ({ code: c.code, name: pick(locals.locale, c.name, c.nameEn) }))
	};
};

async function ownCart(cookies: Parameters<typeof cartIdFrom>[0]) {
	return cartIdFrom(cookies, false);
}

export const actions: Actions = {
	menge: async ({ request, cookies }) => {
		const cartId = await ownCart(cookies);
		if (!cartId) return fail(400);
		const form = await request.formData();
		const id = Number(form.get('zeile'));
		const qty = Math.min(99, Math.max(0, Math.floor(Number(form.get('menge')) || 0)));
		if (qty === 0) await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.cartId, cartId)));
		else await db.update(cartItems).set({ quantity: qty }).where(and(eq(cartItems.id, id), eq(cartItems.cartId, cartId)));
		await touchCart(cartId);
	},
	entfernen: async ({ request, cookies }) => {
		const cartId = await ownCart(cookies);
		if (!cartId) return fail(400);
		const id = Number((await request.formData()).get('zeile'));
		await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.cartId, cartId)));
		await touchCart(cartId);
	},
	code: async ({ request, cookies, locals, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const cartId = await ownCart(cookies);
		if (!cartId) return fail(400);
		const key = `code:${getClientAddress()}`;
		if (isRateLimited(key, 20)) return fail(429, { codeError: L('Zu viele Versuche. Bitte später erneut.', 'Too many attempts. Please try later.') });
		const code = String((await request.formData()).get('code') ?? '')
			.trim()
			.toUpperCase()
			.slice(0, 40);
		if (!code) return fail(400, { codeError: L('Bitte einen Code eingeben.', 'Please enter a code.') });

		// Gutscheincode? Dann als Gutschein hinzufügen
		const card = await db
			.select()
			.from(giftCards)
			.where(sql`upper(${giftCards.code}) = ${code}`)
			.get();
		if (card) {
			if (!card.active || card.balance <= 0) return fail(400, { codeError: L('Dieser Gutschein hat kein Guthaben mehr.', 'This gift card has no balance left.') });
			const cart = (await db.select().from(carts).where(eq(carts.id, cartId)).get())!;
			if (!cart.giftCardCodes.includes(card.code)) await touchCart(cartId, { giftCardCodes: [...cart.giftCardCodes, card.code].slice(0, 5) });
			return { codeOk: L('Gutschein eingelöst.', 'Gift card applied.') };
		}
		const s = await getSettings();
		const check = await checkDiscountCode(code, { dealer: dealerDiscountOf(locals.customer, s) != null, email: locals.customer?.email ?? null });
		if (!check.ok) {
			registerFailure(key);
			return fail(400, { codeError: L('Diesen Code kennen wir nicht oder er ist nicht (mehr) gültig.', "We don't know this code or it is no longer valid.") });
		}
		await touchCart(cartId, { discountCode: check.code.code });
		return { codeOk: L('Rabattcode eingelöst.', 'Discount code applied.') };
	},
	code_entfernen: async ({ cookies }) => {
		const cartId = await ownCart(cookies);
		if (cartId) await touchCart(cartId, { discountCode: null });
	},
	gutschein_entfernen: async ({ request, cookies }) => {
		const cartId = await ownCart(cookies);
		if (!cartId) return;
		const code = String((await request.formData()).get('code') ?? '');
		const cart = await db.select().from(carts).where(eq(carts.id, cartId)).get();
		if (cart) await touchCart(cartId, { giftCardCodes: cart.giftCardCodes.filter((c) => c !== code) });
	},
	land: async ({ request, cookies }) => {
		const cartId = await cartIdFrom(cookies, true);
		const code = String((await request.formData()).get('land') ?? '')
			.toUpperCase()
			.slice(0, 2);
		if (/^[A-Z]{2}$/.test(code)) await touchCart(cartId!, { country: code });
	}
};
