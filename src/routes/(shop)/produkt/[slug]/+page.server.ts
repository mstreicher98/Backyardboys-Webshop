import { error, fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import { db } from '$lib/server/db';
import { cartItems, files } from '$lib/server/db/schema';
import { getSettings } from '$lib/server/settings';
import { cartIdFrom, dealerDiscountOf, touchCart } from '$lib/server/shop/cart';
import {
	bikeCatalog,
	bikeFromCookie,
	configKey,
	findProductIds,
	isReleased,
	loadFullProduct,
	productCards,
	productFits,
	resolveLine,
	variantLabel,
	variantLimit
} from '$lib/server/shop/catalog';
import { dealerUnitPrice } from '$lib/server/shop/pricing';
import type { LineConfig, PersonalizationField } from '$lib/shop-types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const locale = locals.locale;
	const fp = await loadFullProduct({ slug: params.slug });
	// Entwürfe sieht nur das Team (Vorschau aus dem Admin)
	if (!fp || fp.product.status === 'archiviert' || (fp.product.status === 'entwurf' && !locals.user)) {
		error(404, locale === 'en' ? 'This product does not exist (anymore).' : 'Dieses Produkt gibt es nicht (mehr).');
	}
	const s = await getSettings();
	const dealer = dealerDiscountOf(locals.customer, s);
	const { product } = fp;
	const dealerApplies = dealer != null && product.dealerDiscountable && product.kind !== 'gutschein' && product.dekorType !== 'full_custom';
	const priceOf = (v: { price: number; dealerPrice: number | null }) => (dealerApplies ? dealerUnitPrice(v, 0, dealer!) : v.price);
	const surchargeOf = (n: number) => (dealerApplies ? Math.round(n * (1 - dealer! / 100)) : n);
	const fields = (product.fields as PersonalizationField[]).map((f) => ({
		key: f.key,
		type: f.type,
		label: pick(locale, f.label, f.labelEn),
		help: pick(locale, f.help, f.helpEn),
		placeholder: pick(locale, f.placeholder, f.placeholderEn),
		required: f.required,
		choices: f.choices.map((c) => ({ value: c.de, label: pick(locale, c.de, c.en) })),
		maxLength: f.maxLength,
		surcharge: surchargeOf(f.surcharge),
		maxFiles: f.maxFiles || 1
	}));
	const needsBikes = fields.some((f) => f.type === 'bike');
	const [fits, related, bikes, savedBike] = await Promise.all([
		productFits(product.id),
		findProductIds({ categoryIds: fp.categoryIds, limit: 5, excludeId: product.id }).then((ids) => productCards(ids.slice(0, 4), { dealerDiscount: dealer, locale })),
		needsBikes ? bikeCatalog() : null,
		needsBikes ? bikeFromCookie(cookies.get('byb_bike')) : null
	]);

	return {
		product: {
			id: product.id,
			slug: product.slug,
			kind: product.kind,
			dekorType: product.dekorType,
			status: product.status,
			title: pick(locale, product.title, product.titleEn),
			subtitle: pick(locale, product.subtitle, product.subtitleEn),
			descriptionHtml: pick(locale, product.descriptionHtml, product.descriptionHtmlEn),
			leadTime: pick(locale, product.leadTime, product.leadTimeEn),
			releaseDate: isReleased(product) ? null : product.releaseDate,
			universalFit: product.universalFit,
			stockMode: product.stockMode
		},
		images: fp.images,
		options: product.options.map((o) => ({ name: pick(locale, o.name, o.nameEn), values: o.values.map((v) => ({ value: v.de, label: pick(locale, v.de, v.en) })) })),
		variants: fp.variants
			.filter((v) => v.active)
			.map((v) => ({
				id: v.id,
				values: v.optionValues,
				label: variantLabel(product, v, locale),
				price: priceOf(v),
				listPrice: v.price,
				compareAt: dealerApplies ? v.price : v.compareAtPrice,
				limit: variantLimit(product, v)
			})),
		upgrades: fp.upgrades.map(({ group, options }) => ({
			id: group.id,
			name: pick(locale, group.name, group.nameEn),
			options: options.map((o) => ({ id: o.id, name: pick(locale, o.name, o.nameEn), surcharge: surchargeOf(o.surcharge), image: o.image, isDefault: o.isDefault }))
		})),
		fields,
		bundle: fp.bundle.map((b) => ({
			id: b.id,
			quantity: b.quantity,
			title: pick(locale, b.product.title, b.product.titleEn),
			variants: b.variants.map((v) => ({ id: v.id, label: variantLabel(b.product, v, locale) || pick(locale, b.product.title, b.product.titleEn), soldOut: variantLimit(b.product, v) === 0 }))
		})),
		fits: fits.map((f) => ({
			label: `${f.brand} ${f.model}`,
			years: f.yearFrom || f.yearTo ? `${f.yearFrom ?? f.modelFrom}–${f.yearTo ?? f.modelTo ?? ''}` : `${f.modelFrom}–${f.modelTo ?? ''}`
		})),
		bikes,
		savedBike: savedBike ? { modelId: savedBike.modelId, year: savedBike.year } : null,
		related,
		dealer: dealerApplies
	};
};

/* ------------------------------------------------------------ In den Warenkorb */

/** name="upgrades[3]" → { upgrades: { 3: … } } */
function parseConfig(form: FormData): LineConfig {
	const cfg: LineConfig = {};
	for (const [key, raw] of form.entries()) {
		if (typeof raw !== 'string') continue;
		const m = key.match(/^(upgrades|fields|files|bike|bundle|gift)\[([\w-]{1,40})\]$/);
		if (!m) continue;
		const [, group, sub] = m;
		if (group === 'upgrades') (cfg.upgrades ??= {})[sub] = Number(raw);
		else if (group === 'bundle') (cfg.bundle ??= {})[sub] = Number(raw);
		else if (group === 'fields') (cfg.fields ??= {})[sub] = raw;
		else if (group === 'files')
			(cfg.files ??= {})[sub] = raw
				.split(',')
				.map(Number)
				.filter((n) => n > 0);
		else if (group === 'bike') (cfg.bike ??= { brand: '', model: '', year: '' })[sub as 'brand'] = raw;
		else if (group === 'gift') (cfg.gift ??= { name: '', email: '', message: '' })[sub as 'name'] = raw;
	}
	if (cfg.bike && 'modelId' in cfg.bike) cfg.bike.modelId = Number(cfg.bike.modelId) || null;
	return cfg;
}

export const actions: Actions = {
	add: async ({ request, params, locals, cookies }) => {
		const locale = locals.locale;
		const L = (de: string, en: string) => (locale === 'en' ? en : de);
		const fp = await loadFullProduct({ slug: params.slug });
		if (!fp || fp.product.status !== 'aktiv') return fail(404, { error: L('Dieses Produkt ist nicht erhältlich.', 'This product is not available.') });
		const form = await request.formData();
		const variantId = Number(form.get('variante'));
		const qty = Math.min(99, Math.max(1, Math.floor(Number(form.get('menge')) || 1)));
		const cartId = (await cartIdFrom(cookies, true, locals.customer?.id ?? null))!;
		const own = new Set((await db.select({ id: files.id }).from(files).where(eq(files.cartId, cartId)).all()).map((f) => f.id));
		const s = await getSettings();
		const r = resolveLine(fp, variantId, parseConfig(form), { dealerDiscount: dealerDiscountOf(locals.customer, s), locale }, own);
		if (Object.keys(r.errors).length) return fail(400, { errors: r.errors, error: Object.values(r.errors)[0] });

		const key = configKey(variantId, r.config);
		const existing = await db
			.select()
			.from(cartItems)
			.where(and(eq(cartItems.cartId, cartId), eq(cartItems.configKey, key)))
			.get();
		const wanted = qty + (existing?.quantity ?? 0);
		if (r.limit != null && wanted > r.limit) {
			return fail(400, { error: r.limit === 0 ? L('Leider ausverkauft.', 'Sorry, sold out.') : L(`Nur noch ${r.limit} Stück verfügbar.`, `Only ${r.limit} left.`) });
		}
		// Personalisierte Dekore und Gutscheine mit Empfänger nicht zusammenfassen – jede Bestellung ist ein eigener Auftrag
		if (existing && fp.product.kind !== 'dekor' && !r.config.gift) {
			await db
				.update(cartItems)
				.set({ quantity: sql`${cartItems.quantity} + ${qty}` })
				.where(eq(cartItems.id, existing.id));
		} else {
			await db.insert(cartItems).values({ cartId, productId: fp.product.id, variantId, quantity: qty, config: r.config, configKey: key });
		}
		await touchCart(cartId);
		return { added: true };
	}
};
