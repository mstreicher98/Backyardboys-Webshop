import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { pick } from '$lib/i18n.svelte';
import type { MediaRef } from '$lib/media';
import type { BikeRef, LineConfig, LineConfigSnapshot, Locale, PersonalizationField } from '$lib/shop-types';
import { db } from '../db';
import {
	bikeBrands,
	bikeModels,
	bundleItems,
	categories,
	media,
	productBikes,
	productCategories,
	productImages,
	products,
	upgradeGroups,
	upgradeOptions,
	variants,
	type Category,
	type Product,
	type UpgradeGroup,
	type UpgradeOption,
	type Variant
} from '../db/schema';
import { dealerUnitPrice } from './pricing';

/* ================================================================ Laden */

export interface FullProduct {
	product: Product;
	variants: Variant[];
	images: MediaRef[];
	categoryIds: number[];
	upgrades: { group: UpgradeGroup; options: (UpgradeOption & { image: MediaRef | null })[] }[];
	bundle: { id: number; quantity: number; product: Product; variants: Variant[] }[];
}

const MEDIA_COLS = { id: media.id, file: media.file, widths: media.widths, width: media.width, height: media.height, alt: media.alt };

/** Produkt mit allem, was Seite, Warenkorb und Bestellung brauchen */
export async function loadFullProduct(where: { id: number } | { slug: string }): Promise<FullProduct | null> {
	const product = await db
		.select()
		.from(products)
		.where('id' in where ? eq(products.id, where.id) : eq(products.slug, where.slug))
		.get();
	if (!product) return null;
	const [vs, imgs, cats] = await Promise.all([
		db.select().from(variants).where(eq(variants.productId, product.id)).orderBy(asc(variants.sortOrder), asc(variants.id)).all(),
		db
			.select(MEDIA_COLS)
			.from(productImages)
			.innerJoin(media, eq(media.id, productImages.mediaId))
			.where(eq(productImages.productId, product.id))
			.orderBy(asc(productImages.sortOrder))
			.all(),
		db.select({ id: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, product.id)).all()
	]);

	let upgrades: FullProduct['upgrades'] = [];
	if (product.upgradeGroupIds.length) {
		const groups = await db.select().from(upgradeGroups).where(inArray(upgradeGroups.id, product.upgradeGroupIds)).orderBy(asc(upgradeGroups.sortOrder)).all();
		const opts = await db
			.select({ option: upgradeOptions, image: MEDIA_COLS })
			.from(upgradeOptions)
			.leftJoin(media, eq(media.id, upgradeOptions.mediaId))
			.where(and(inArray(upgradeOptions.groupId, product.upgradeGroupIds), eq(upgradeOptions.active, true)))
			.orderBy(asc(upgradeOptions.sortOrder), asc(upgradeOptions.id))
			.all();
		upgrades = groups.map((group) => ({
			group,
			options: opts.filter((o) => o.option.groupId === group.id).map((o) => ({ ...o.option, image: o.image?.id ? (o.image as MediaRef) : null }))
		}));
	}

	let bundle: FullProduct['bundle'] = [];
	if (product.kind === 'bundle') {
		const items = await db
			.select({ item: bundleItems, product: products })
			.from(bundleItems)
			.innerJoin(products, eq(products.id, bundleItems.productId))
			.where(eq(bundleItems.bundleId, product.id))
			.orderBy(asc(bundleItems.sortOrder), asc(bundleItems.id))
			.all();
		const compVariants = items.length
			? await db
					.select()
					.from(variants)
					.where(inArray(variants.productId, items.map((i) => i.product.id)))
					.orderBy(asc(variants.sortOrder), asc(variants.id))
					.all()
			: [];
		bundle = items.map((i) => ({
			id: i.item.id,
			quantity: i.item.quantity,
			product: i.product,
			variants: compVariants.filter((v) => v.productId === i.product.id && v.active)
		}));
	}

	return { product, variants: vs, images: imgs, categoryIds: cats.map((c) => c.id), upgrades, bundle };
}

/** Mehrere Produkte je Anfrage nur einmal laden */
export function productLoader() {
	const cache = new Map<number, Promise<FullProduct | null>>();
	return (id: number) => {
		let p = cache.get(id);
		if (!p) {
			p = loadFullProduct({ id });
			cache.set(id, p);
		}
		return p;
	};
}

/* ================================================================ Verfügbarkeit */

export function isReleased(p: Pick<Product, 'releaseDate'>, today = todayIso()): boolean {
	return !p.releaseDate || p.releaseDate <= today;
}

export function todayIso(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
}

/** Wie viele Stück lassen sich bestellen? null = unbegrenzt */
export function variantLimit(p: Product, v: Variant): number | null {
	if (!v.active) return 0;
	if (p.stockMode === 'auf_bestellung' || p.backorder) return null;
	return Math.max(0, v.stock);
}

export function bundleLimit(fp: FullProduct, selection: Record<string, number> | undefined): number | null {
	let limit: number | null = null;
	for (const item of fp.bundle) {
		const vid = item.variants.length === 1 ? item.variants[0].id : selection?.[String(item.id)];
		const v = item.variants.find((x) => x.id === vid);
		if (!v) return 0;
		const l = variantLimit(item.product, v);
		if (l != null) {
			const perBundle = Math.floor(l / item.quantity);
			limit = limit == null ? perBundle : Math.min(limit, perBundle);
		}
	}
	return limit;
}

export function isPurchasable(p: Product): boolean {
	return p.status === 'aktiv';
}

/* ================================================================ Varianten-Bezeichnung */

export function variantLabel(p: Pick<Product, 'options'>, v: Pick<Variant, 'optionValues'>, locale: Locale): string {
	return v.optionValues
		.map((val, i) => {
			const opt = p.options[i];
			const found = opt?.values.find((x) => x.de === val);
			return found ? pick(locale, found.de, found.en) : val;
		})
		.join(' / ');
}

/* ================================================================ Konfiguration prüfen */

export interface PriceContext {
	/** Händlerrabatt in Prozent, null = kein Händler */
	dealerDiscount: number | null;
	locale: Locale;
}

export interface ResolvedLine {
	errors: Record<string, string>;
	config: LineConfig;
	snapshot: LineConfigSnapshot;
	/** Stückpreis inkl. Aufpreisen (bei Händlern rabattiert) */
	unitPrice: number;
	/** Listenpreis ohne Händlerrabatt – zum Durchstreichen */
	listUnitPrice: number;
	variantTitle: string;
	limit: number | null;
	/** Datei-IDs, die mit bestellt werden */
	fileIds: number[];
}

const clean = (s: unknown, max: number) =>
	String(s ?? '')
		.replace(/\r\n/g, '\n')
		.trim()
		.slice(0, max);

/**
 * Prüft, was der Kunde gewählt hat, und berechnet den Stückpreis.
 * Wird beim Hinzufügen, bei jeder Anzeige des Warenkorbs und beim Bestellen
 * erneut aufgerufen – Preise kommen also nie aus dem Browser.
 */
export function resolveLine(
	fp: FullProduct,
	variantId: number,
	raw: LineConfig,
	ctx: PriceContext,
	allowedFileIds: Set<number> | null = null
): ResolvedLine {
	const { product } = fp;
	const L = (de: string, en: string) => (ctx.locale === 'en' ? en : de);
	const errors: Record<string, string> = {};
	const config: LineConfig = {};
	const snapshot: LineConfigSnapshot = {};
	let surcharges = 0;
	const fileIds: number[] = [];

	const variant = fp.variants.find((v) => v.id === variantId && v.active);
	if (!variant) errors.variant = L('Bitte eine Ausführung wählen.', 'Please choose an option.');

	/* Upgrades: je Gruppe genau eine Option */
	if (fp.upgrades.length) {
		config.upgrades = {};
		snapshot.upgrades = [];
		for (const { group, options } of fp.upgrades) {
			if (!options.length) continue;
			const chosenId = Number(raw.upgrades?.[String(group.id)]);
			const opt = options.find((o) => o.id === chosenId) ?? options.find((o) => o.isDefault) ?? null;
			if (!opt) {
				errors[`upgrade_${group.id}`] = L(`Bitte ${group.name} wählen.`, `Please choose ${pick('en', group.name, group.nameEn)}.`);
				continue;
			}
			config.upgrades[String(group.id)] = opt.id;
			surcharges += opt.surcharge;
			snapshot.upgrades.push({ group: pick(ctx.locale, group.name, group.nameEn), option: pick(ctx.locale, opt.name, opt.nameEn), surcharge: opt.surcharge });
		}
	}

	/* Personalisierung */
	const fields = product.fields as PersonalizationField[];
	if (fields.length) {
		for (const f of fields) {
			const label = pick(ctx.locale, f.label, f.labelEn);
			if (f.type === 'datei') {
				const ids = (raw.files?.[f.key] ?? [])
					.map(Number)
					.filter((id) => Number.isInteger(id) && id > 0 && (!allowedFileIds || allowedFileIds.has(id)))
					.slice(0, Math.max(1, f.maxFiles || 1));
				if (f.required && !ids.length) errors[f.key] = L(`${f.label}: bitte Datei hochladen.`, `${label}: please upload a file.`);
				if (ids.length) {
					(config.files ??= {})[f.key] = ids;
					(snapshot.files ??= []).push({ key: f.key, label, fileIds: ids });
					fileIds.push(...ids);
					surcharges += f.surcharge;
				}
				continue;
			}
			if (f.type === 'bike') {
				const b = raw.bike;
				const bike: BikeRef = {
					brand: clean(b?.brand, 60),
					model: clean(b?.model, 80),
					year: clean(b?.year, 4),
					modelId: Number(b?.modelId) || null
				};
				const filled = bike.brand && bike.model && /^\d{4}$/.test(bike.year);
				if (f.required && !filled) errors[f.key] = L('Bitte Marke, Modell und Baujahr angeben.', 'Please enter brand, model and year.');
				else if (bike.brand || bike.model || bike.year) {
					if (bike.year && !/^\d{4}$/.test(bike.year)) errors[f.key] = L('Baujahr bitte vierstellig, z. B. 2021.', 'Year as four digits, e.g. 2021.');
					config.bike = bike;
					snapshot.bike = bike;
				}
				continue;
			}
			const max = f.type === 'textarea' ? Math.min(f.maxLength || 2000, 4000) : Math.min(f.maxLength || 120, 500);
			let value = clean(raw.fields?.[f.key], max);
			if (f.type === 'number' && value && !/^-?\d+([.,]\d+)?$/.test(value)) {
				errors[f.key] = L(`${f.label}: bitte eine Zahl eingeben.`, `${label}: please enter a number.`);
				continue;
			}
			if (f.type === 'select' && value) {
				const choice = f.choices.find((c) => c.de === value);
				if (!choice) {
					errors[f.key] = L(`${f.label}: bitte eine Auswahl treffen.`, `${label}: please choose an option.`);
					continue;
				}
				value = choice.de;
			}
			if (f.required && !value) {
				errors[f.key] = L(`${f.label} fehlt.`, `${label} is required.`);
				continue;
			}
			if (value) {
				(config.fields ??= {})[f.key] = value;
				const shown = f.type === 'select' ? pick(ctx.locale, value, f.choices.find((c) => c.de === value)?.en) : value;
				(snapshot.fields ??= []).push({ key: f.key, label, value: shown, surcharge: f.surcharge });
				surcharges += f.surcharge;
			}
		}
	}

	/* Bundle: Variante je Bestandteil */
	if (product.kind === 'bundle') {
		config.bundle = {};
		snapshot.bundle = [];
		for (const item of fp.bundle) {
			const chosen = item.variants.length === 1 ? item.variants[0].id : Number(raw.bundle?.[String(item.id)]);
			const v = item.variants.find((x) => x.id === chosen);
			if (!v) {
				errors[`bundle_${item.id}`] = L(`Bitte Ausführung für ${item.product.title} wählen.`, `Please choose an option for ${pick('en', item.product.title, item.product.titleEn)}.`);
				continue;
			}
			config.bundle[String(item.id)] = v.id;
			snapshot.bundle.push({
				title: pick(ctx.locale, item.product.title, item.product.titleEn),
				variantTitle: item.product.options.length ? variantLabel(item.product, v, ctx.locale) : '',
				quantity: item.quantity
			});
		}
	}

	/* Gutschein: Empfänger (optional) */
	if (product.kind === 'gutschein') {
		const g = raw.gift;
		const gift = { name: clean(g?.name, 80), email: clean(g?.email, 200).toLowerCase(), message: clean(g?.message, 500) };
		if (gift.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(gift.email)) errors.gift = L('Die E-Mail-Adresse des Empfängers stimmt nicht.', "The recipient's email address is not valid.");
		if (gift.name || gift.email || gift.message) {
			config.gift = gift;
			snapshot.gift = gift;
		}
	}

	const base = variant ?? { price: 0, dealerPrice: null };
	// Full Custom: der Preis ist die Anzahlung – Aufpreise fließen in den Endpreis, den das Team festlegt
	if (product.dekorType === 'full_custom') surcharges = 0;
	const listUnitPrice = base.price + surcharges;
	const dealer = ctx.dealerDiscount != null && product.dealerDiscountable && product.kind !== 'gutschein' && product.dekorType !== 'full_custom';
	const unitPrice = dealer ? dealerUnitPrice(base, surcharges, ctx.dealerDiscount!) : listUnitPrice;

	let limit: number | null = 0;
	if (variant && isPurchasable(product)) {
		limit = product.kind === 'bundle' ? bundleLimit(fp, config.bundle) : variantLimit(product, variant);
	}

	return {
		errors,
		config,
		snapshot,
		unitPrice,
		listUnitPrice,
		variantTitle: variant && product.options.length ? variantLabel(product, variant, ctx.locale) : '',
		limit,
		fileIds
	};
}

/** Gleiche Konfiguration → gleicher Schlüssel (Menge zusammenfassen) */
export function configKey(variantId: number, config: LineConfig): string {
	const sortKeys = (v: unknown): unknown =>
		Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sortKeys(x)])) : v;
	return `${variantId}:${JSON.stringify(sortKeys(config))}`;
}

/* ================================================================ Listen für den Shop */

export interface ProductCard {
	id: number;
	slug: string;
	title: string;
	subtitle: string;
	kind: Product['kind'];
	dekorType: Product['dekorType'];
	image: MediaRef | null;
	image2: MediaRef | null;
	/** kleinster Preis */
	priceFrom: number;
	compareAt: number | null;
	multiplePrices: boolean;
	soldOut: boolean;
	preorder: boolean;
}

export async function productCards(ids: number[], ctx: PriceContext): Promise<ProductCard[]> {
	if (!ids.length) return [];
	const [rows, vs, imgs] = await Promise.all([
		db.select().from(products).where(inArray(products.id, ids)).all(),
		db.select().from(variants).where(and(inArray(variants.productId, ids), eq(variants.active, true))).all(),
		db
			.select({ productId: productImages.productId, sortOrder: productImages.sortOrder, ...MEDIA_COLS })
			.from(productImages)
			.innerJoin(media, eq(media.id, productImages.mediaId))
			.where(inArray(productImages.productId, ids))
			.orderBy(asc(productImages.sortOrder))
			.all()
	]);
	const today = todayIso();
	const byId = new Map(rows.map((r) => [r.id, r]));
	return ids
		.map((id) => byId.get(id))
		.filter((p): p is Product => !!p)
		.map((p) => {
			const pv = vs.filter((v) => v.productId === p.id);
			const dealer = ctx.dealerDiscount != null && p.dealerDiscountable && p.kind !== 'gutschein' && p.dekorType !== 'full_custom';
			const prices = pv.map((v) => (dealer ? dealerUnitPrice(v, 0, ctx.dealerDiscount!) : v.price));
			const min = prices.length ? Math.min(...prices) : 0;
			const cheapest = pv[prices.indexOf(min)];
			const pimgs = imgs.filter((i) => i.productId === p.id);
			const soldOut = p.kind !== 'bundle' && pv.length > 0 && pv.every((v) => variantLimit(p, v) === 0);
			const strip = (m: (typeof pimgs)[number] | undefined): MediaRef | null =>
				m ? { id: m.id, file: m.file, widths: m.widths, width: m.width, height: m.height, alt: m.alt } : null;
			return {
				id: p.id,
				slug: p.slug,
				title: pick(ctx.locale, p.title, p.titleEn),
				subtitle: pick(ctx.locale, p.subtitle, p.subtitleEn),
				kind: p.kind,
				dekorType: p.dekorType,
				image: strip(pimgs[0]),
				image2: strip(pimgs[1]),
				priceFrom: min,
				compareAt: dealer ? (cheapest?.price ?? null) : (cheapest?.compareAtPrice ?? null),
				multiplePrices: new Set(prices).size > 1,
				soldOut,
				preorder: !isReleased(p, today)
			};
		});
}

export type SortKey = 'empfohlen' | 'neu' | 'preis_auf' | 'preis_ab';

/** IDs aktiver Produkte, gefiltert und sortiert */
export async function findProductIds(opts: {
	categoryIds?: number[];
	search?: string;
	bike?: { modelId: number; year: number | null } | null;
	sort?: SortKey;
	featured?: boolean;
	limit?: number;
	excludeId?: number;
}): Promise<number[]> {
	const conds = [eq(products.status, 'aktiv')];
	if (opts.categoryIds?.length) {
		conds.push(inArray(products.id, db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, opts.categoryIds))));
	}
	if (opts.featured) conds.push(eq(products.featured, true));
	if (opts.excludeId) conds.push(sql`${products.id} <> ${opts.excludeId}`);
	if (opts.search) {
		const q = `%${opts.search.replace(/[%_]/g, ' ').trim()}%`;
		conds.push(or(like(products.title, q), like(products.titleEn, q), like(products.subtitle, q), like(products.descriptionHtml, q))!);
	}
	if (opts.bike) {
		const { modelId, year } = opts.bike;
		const fits = db
			.select({ id: productBikes.productId })
			.from(productBikes)
			.where(
				and(
					eq(productBikes.modelId, modelId),
					year == null ? sql`1 = 1` : sql`(${productBikes.yearFrom} IS NULL OR ${productBikes.yearFrom} <= ${year}) AND (${productBikes.yearTo} IS NULL OR ${productBikes.yearTo} >= ${year})`
				)
			);
		conds.push(or(inArray(products.id, fits), eq(products.universalFit, true))!);
	}
	const minPrice = sql<number>`(SELECT min(${variants.price}) FROM ${variants} WHERE ${variants.productId} = ${products.id} AND ${variants.active} = 1)`;
	const order =
		opts.sort === 'neu'
			? [desc(products.createdAt)]
			: opts.sort === 'preis_auf'
				? [asc(minPrice)]
				: opts.sort === 'preis_ab'
					? [desc(minPrice)]
					: [desc(products.featured), asc(products.sortOrder), desc(products.createdAt)];
	const rows = await db
		.select({ id: products.id })
		.from(products)
		.where(and(...conds))
		.orderBy(...order)
		.limit(opts.limit ?? 500)
		.all();
	return rows.map((r) => r.id);
}

/* ================================================================ Kategorien */

export interface CategoryNode {
	id: number;
	slug: string;
	name: string;
	tagline: string;
	image: MediaRef | null;
	children: CategoryNode[];
	parentId: number | null;
}

export async function categoryTree(locale: Locale, onlyMenu = false): Promise<CategoryNode[]> {
	const rows = await db
		.select({ c: categories, m: MEDIA_COLS })
		.from(categories)
		.leftJoin(media, eq(media.id, categories.mediaId))
		.where(onlyMenu ? and(eq(categories.active, true), eq(categories.showInMenu, true)) : eq(categories.active, true))
		.orderBy(asc(categories.sortOrder), asc(categories.name))
		.all();
	const nodes = rows.map(
		({ c, m }): CategoryNode => ({
			id: c.id,
			slug: c.slug,
			name: pick(locale, c.name, c.nameEn),
			tagline: pick(locale, c.tagline, c.taglineEn),
			image: m?.id ? (m as MediaRef) : null,
			children: [],
			parentId: c.parentId
		})
	);
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const roots: CategoryNode[] = [];
	for (const n of nodes) {
		const parent = n.parentId ? byId.get(n.parentId) : null;
		if (parent) parent.children.push(n);
		else roots.push(n);
	}
	return roots;
}

/** Kategorie samt Unterkategorien (für Filter) */
export async function categoryWithDescendants(slug: string): Promise<{ category: Category; ids: number[] } | null> {
	const all = await db.select().from(categories).where(eq(categories.active, true)).all();
	const category = all.find((c) => c.slug === slug);
	if (!category) return null;
	const ids = [category.id];
	for (let i = 0; i < ids.length; i++) for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
	return { category, ids };
}

/* ================================================================ Bike-Finder */

export interface BikeCatalog {
	brands: { id: number; name: string; slug: string }[];
	models: { id: number; brandId: number; name: string; category: string; yearFrom: number; yearTo: number | null }[];
}

export async function bikeCatalog(): Promise<BikeCatalog> {
	const [brands, models] = await Promise.all([
		db
			.select({ id: bikeBrands.id, name: bikeBrands.name, slug: bikeBrands.slug })
			.from(bikeBrands)
			.where(eq(bikeBrands.active, true))
			.orderBy(asc(bikeBrands.sortOrder), asc(bikeBrands.name))
			.all(),
		db
			.select({ id: bikeModels.id, brandId: bikeModels.brandId, name: bikeModels.name, category: bikeModels.category, yearFrom: bikeModels.yearFrom, yearTo: bikeModels.yearTo })
			.from(bikeModels)
			.where(eq(bikeModels.active, true))
			.orderBy(asc(bikeModels.name))
			.all()
	]);
	return { brands, models };
}

/** Gespeichertes Bike aus dem Cookie "modelId:jahr" */
export async function bikeFromCookie(value: string | undefined) {
	const m = value?.match(/^(\d+):(\d{4})?$/);
	if (!m) return null;
	const row = await db
		.select({ modelId: bikeModels.id, model: bikeModels.name, brand: bikeBrands.name, yearFrom: bikeModels.yearFrom, yearTo: bikeModels.yearTo })
		.from(bikeModels)
		.innerJoin(bikeBrands, eq(bikeBrands.id, bikeModels.brandId))
		.where(eq(bikeModels.id, Number(m[1])))
		.get();
	return row ? { ...row, year: m[2] ? Number(m[2]) : null } : null;
}

/** Für die Produktseite: auf welche Bikes passt das Dekor? */
export async function productFits(productId: number) {
	return db
		.select({ brand: bikeBrands.name, model: bikeModels.name, modelId: bikeModels.id, yearFrom: productBikes.yearFrom, yearTo: productBikes.yearTo, modelFrom: bikeModels.yearFrom, modelTo: bikeModels.yearTo })
		.from(productBikes)
		.innerJoin(bikeModels, eq(bikeModels.id, productBikes.modelId))
		.innerJoin(bikeBrands, eq(bikeBrands.id, bikeModels.brandId))
		.where(eq(productBikes.productId, productId))
		.orderBy(asc(bikeBrands.name), asc(bikeModels.name))
		.all();
}
