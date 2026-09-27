#!/usr/bin/env node
/**
 * Beispieldaten zum Ausprobieren: ein paar Produkte (alle Arten) und Bike-Modelle.
 * Die Produkte beginnen mit „demo-“ in der Adresse und lassen sich wieder entfernen.
 *
 *   node scripts/demo.mjs            anlegen
 *   node scripts/demo.mjs --entfernen  Demo-Produkte löschen (nur solche ohne Bestellungen)
 *
 * Voraussetzung: der Shop wurde einmal gestartet (Datenbank und Grunddaten existieren).
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@libsql/client';

const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const db = createClient({ url: `file:${path.join(DATA_DIR, 'shop.db')}` });
const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];
const all = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const run = (sql, args = []) => db.execute({ sql, args });

if (!(await one("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'"))) {
	console.error('Keine Datenbank gefunden – bitte den Shop zuerst einmal starten.');
	process.exit(1);
}

if (process.argv.includes('--entfernen')) {
	const rows = await all("SELECT id, title FROM products WHERE slug LIKE 'demo-%' AND id NOT IN (SELECT product_id FROM order_items WHERE product_id IS NOT NULL)");
	for (const r of rows) await run('DELETE FROM products WHERE id = ?', [r.id]);
	console.log(`${rows.length} Demo-Produkte entfernt.`);
	process.exit(0);
}

/** Bild aus seed/ wie media.ts ablegen (WebP in 400/800/1600) */
async function image(rel, alt) {
	const file = path.resolve('seed', rel);
	const meta = await sharp(file).metadata();
	const widths = [400, 800, 1600].filter((w) => w <= meta.width);
	if (!widths.length || widths.at(-1) < meta.width) widths.push(Math.min(meta.width, 1600));
	const name = randomBytes(10).toString('hex');
	let info;
	for (const w of [...new Set(widths)]) info = await sharp(file).resize({ width: w }).webp({ quality: 80 }).toFile(path.join(UPLOAD_DIR, `${name}-${w}.webp`));
	const r = await one('INSERT INTO media (kind, file, original_name, widths, width, height, size_bytes, alt, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [
		'bild',
		name,
		path.basename(file),
		[...new Set(widths)].join(','),
		info.width,
		info.height,
		info.size,
		alt,
		Date.now()
	]);
	return Number(r.id);
}

const cat = async (slug) => Number((await one('SELECT id FROM categories WHERE slug = ?', [slug]))?.id ?? 0);
const groups = (await all('SELECT id FROM upgrade_groups ORDER BY sort_order')).map((r) => Number(r.id));

// Aufpreise nur setzen, wenn noch keine eingetragen sind
if (!(await one('SELECT id FROM upgrade_options WHERE surcharge > 0'))) {
	const set = [
		['Full Chrome', 4900],
		['Full Holographic Chrome', 6900],
		['Matte', 1900],
		['Holographic Glitter', 2900]
	];
	for (const [name, s] of set) await run('UPDATE upgrade_options SET surcharge = ? WHERE name = ?', [s, name]);
}

/* ---------------- Bike-Modelle */
const models = [
	['KTM', 'EXC 300', 'Enduro', 2017, 2023],
	['KTM', 'EXC 300', 'Enduro', 2024, null],
	['KTM', 'SX 125', 'MX', 2023, null],
	['KTM', '690 SMC R', 'Supermoto', 2019, null],
	['Husqvarna', 'TE 300', 'Enduro', 2017, 2023],
	['Yamaha', 'YZ 250F', 'MX', 2019, 2023],
	['Honda', 'CRF 450R', 'MX', 2021, 2024],
	['Beta', 'RR 300', 'Enduro', 2020, null]
];
const modelIds = {};
for (const [brand, name, category, from, to] of models) {
	const b = await one('SELECT id FROM bike_brands WHERE name = ?', [brand]);
	if (!b) continue;
	let m = await one('SELECT id FROM bike_models WHERE brand_id = ? AND name = ? AND year_from = ?', [b.id, name, from]);
	if (!m) m = await one('INSERT INTO bike_models (brand_id, name, category, year_from, year_to, active) VALUES (?,?,?,?,?,1) RETURNING id', [b.id, name, category, from, to]);
	modelIds[`${brand} ${name} ${from}`] = Number(m.id);
}

/* ---------------- Produkte */
const FIELDS = {
	full: [
		{ key: 'bike', type: 'bike', label: 'Dein Bike', labelEn: 'Your bike', required: true },
		{ key: 'kunststoffteile', type: 'textarea', label: 'Informationen über deine Kunststoffteile', labelEn: 'About your plastics', placeholder: 'z. B. schwarze Kunststoffteile mit KTM SMCR Kotflügel', maxLength: 500 },
		{ key: 'farben', type: 'textarea', label: 'Farben', labelEn: 'Colours', placeholder: 'z. B. Rot mit weißen Details, schwarzer Hintergrund', maxLength: 500 },
		{ key: 'design', type: 'textarea', label: 'Wie möchtest du dein Design gestalten?', labelEn: 'How would you like your design?', required: true, maxLength: 4000 },
		{ key: 'startnummer', type: 'text', label: 'Startnummer', labelEn: 'Race number', maxLength: 4 },
		{ key: 'vorlagen', type: 'datei', label: 'Fotos, Logos oder Vorlagen', labelEn: 'Photos, logos or references', maxFiles: 8 }
	],
	semi: [
		{ key: 'bike', type: 'bike', label: 'Dein Bike', labelEn: 'Your bike', required: true },
		{ key: 'name', type: 'text', label: 'Name / Schriftzug', labelEn: 'Name / lettering', maxLength: 30 },
		{ key: 'startnummer', type: 'text', label: 'Startnummer', labelEn: 'Race number', maxLength: 4, surcharge: 900 },
		{ key: 'logo', type: 'datei', label: 'Eigenes Logo', labelEn: 'Your own logo', maxFiles: 2 }
	],
	reprint: [
		{ key: 'bestellnummer', type: 'text', label: 'Nummer deiner früheren Bestellung', labelEn: 'Number of your earlier order', required: true, maxLength: 20 },
		{ key: 'umfang', type: 'textarea', label: 'Was sollen wir neu drucken?', labelEn: 'What should we reprint?', required: true, maxLength: 2000 }
	]
};
const field = (f) => ({ help: '', helpEn: '', placeholder: '', placeholderEn: '', required: false, choices: [], maxLength: 120, surcharge: 0, maxFiles: 1, ...f });
const html = (s) => s.split('\n\n').map((p) => `<p>${p}</p>`).join('');

const products = [
	{
		slug: 'demo-full-custom',
		kind: 'dekor',
		dekor: 'full_custom',
		title: 'Full Custom Dekor Kit',
		titleEn: 'Full custom graphics kit',
		subtitle: 'Dein Design, von uns gestaltet',
		subtitleEn: 'Your design, created by us',
		desc: 'Du beschreibst uns deine Idee, wir gestalten dein komplettes Dekor-Kit. Den Entwurf siehst du vorab und gibst ihn frei.\n\nDer angegebene Preis ist die Anzahlung. Der Endpreis richtet sich nach Umfang und Upgrades – die Anzahlung wird abgezogen.',
		leadTime: '3–4 Wochen nach Freigabe',
		leadTimeEn: '3–4 weeks after approval',
		image: 'kategorien/full-custom.webp',
		cats: ['full-custom'],
		variants: [{ values: [], price: 5000 }],
		fields: FIELDS.full,
		universal: true,
		featured: true,
		upgrades: groups
	},
	{
		slug: 'demo-japan-edition',
		kind: 'dekor',
		dekor: 'semi_custom',
		title: 'Japan Edition',
		titleEn: 'Japan Edition',
		subtitle: 'Semi Custom Dekor-Kit',
		subtitleEn: 'Semi custom graphics kit',
		desc: 'Rote Sonne, Kirschblüten, Torii – unser Japan-Design, personalisiert mit deinem Namen und deiner Startnummer.',
		leadTime: '2–3 Wochen',
		leadTimeEn: '2–3 weeks',
		image: 'kategorien/semi-custom.webp',
		cats: ['semi-custom'],
		variants: [{ values: [], price: 18900 }],
		fields: FIELDS.semi,
		featured: true,
		upgrades: groups,
		fits: ['KTM EXC 300 2017', 'KTM EXC 300 2024', 'Husqvarna TE 300 2017']
	},
	{
		slug: 'demo-reprint',
		kind: 'dekor',
		dekor: 'reprint',
		title: 'Reprint Dekor Kit',
		titleEn: 'Reprint graphics kit',
		subtitle: 'Dein Dekor nochmal',
		subtitleEn: 'Your graphics again',
		desc: 'Du hattest schon ein Dekor von uns? Wir drucken es neu – komplett oder nur einzelne Teile.',
		leadTime: '1–2 Wochen',
		image: 'kategorien/reprint-graphics.webp',
		cats: ['reprint'],
		variants: [{ values: [], price: 14900 }],
		fields: FIELDS.reprint,
		universal: true,
		upgrades: groups
	},
	{
		slug: 'demo-logo-hoodie',
		kind: 'standard',
		title: 'BYB Logo Hoodie',
		titleEn: 'BYB logo hoodie',
		subtitle: 'Schwarz, Logo vorne',
		subtitleEn: 'Black, logo on the front',
		desc: 'Schwerer Hoodie mit großem BYB-Logo.',
		image: 'kategorien/hoodie.webp',
		cats: ['hoodies'],
		options: [{ name: 'Größe', nameEn: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'].map((v) => ({ de: v, en: v })) }],
		variants: ['S', 'M', 'L', 'XL', 'XXL'].map((v, i) => ({ values: [v], price: 5900, stock: i === 4 ? 0 : 4 })),
		stock: true,
		featured: true
	},
	{
		slug: 'demo-t-shirt',
		kind: 'standard',
		title: 'BYB T-Shirt',
		titleEn: 'BYB T-shirt',
		desc: 'T-Shirt mit Logo-Print.',
		image: 'kategorien/shirt.webp',
		cats: ['t-shirts'],
		options: [
			{ name: 'Größe', nameEn: 'Size', values: ['S', 'M', 'L', 'XL'].map((v) => ({ de: v, en: v })) },
			{ name: 'Farbe', nameEn: 'Colour', values: [{ de: 'Schwarz', en: 'Black' }, { de: 'Weiß', en: 'White' }] }
		],
		variants: ['S', 'M', 'L', 'XL'].flatMap((s) => ['Schwarz', 'Weiß'].map((c) => ({ values: [s, c], price: 2900 })))
	},
	{
		slug: 'demo-sticker-pack',
		kind: 'standard',
		title: 'Sticker Pack',
		titleEn: 'Sticker pack',
		subtitle: '10 Premium-Sticker',
		subtitleEn: '10 premium stickers',
		desc: 'Zehn Sticker für Helm, Box und Werkzeugkiste.',
		image: 'kategorien/sticker.webp',
		cats: ['sticker'],
		variants: [{ values: [], price: 900, compare: 1200 }]
	},
	{
		slug: 'demo-air-freshener',
		kind: 'standard',
		title: 'Air Freshener',
		titleEn: 'Air freshener',
		desc: 'Duftbaum im BYB-Design.',
		image: 'kategorien/air-freshener.webp',
		cats: ['air-freshener'],
		options: [{ name: 'Duft', nameEn: 'Scent', values: [{ de: 'Vanille', en: 'Vanilla' }, { de: 'Black Ice', en: 'Black Ice' }] }],
		variants: [
			{ values: ['Vanille'], price: 690 },
			{ values: ['Black Ice'], price: 690 }
		]
	},
	{
		slug: 'demo-gutschein',
		kind: 'gutschein',
		title: 'Gutschein',
		titleEn: 'Gift card',
		subtitle: 'Per E-Mail, sofort',
		subtitleEn: 'By email, instantly',
		desc: 'Der Gutschein kommt per E-Mail – an dich oder direkt an die beschenkte Person.',
		image: 'kategorien/giftcard.webp',
		cats: ['gutscheine'],
		options: [{ name: 'Wert', nameEn: 'Value', values: ['25 €', '50 €', '100 €'].map((v) => ({ de: v, en: v })) }],
		variants: [
			{ values: ['25 €'], price: 2500 },
			{ values: ['50 €'], price: 5000 },
			{ values: ['100 €'], price: 10000 }
		],
		noShipping: true
	}
];

let created = 0;
for (const [i, p] of products.entries()) {
	if (await one('SELECT id FROM products WHERE slug = ?', [p.slug])) continue;
	const now = Date.now();
	const row = await one(
		`INSERT INTO products (slug, kind, dekor_type, status, title, title_en, subtitle, subtitle_en, description_html, description_html_en, options, stock_mode, backorder, lead_time, lead_time_en,
			upgrade_group_ids, fields, universal_fit, requires_shipping, dealer_discountable, featured, sort_order, created_at, updated_at)
		 VALUES (?,?,?,'aktiv',?,?,?,?,?,'',?,?,0,?,?,?,?,?,?,1,?,?,?,?) RETURNING id`,
		[
			p.slug,
			p.kind,
			p.dekor ?? null,
			p.title,
			p.titleEn ?? '',
			p.subtitle ?? '',
			p.subtitleEn ?? '',
			html(p.desc),
			JSON.stringify(p.options ?? []),
			p.stock ? 'bestand' : 'auf_bestellung',
			p.leadTime ?? '',
			p.leadTimeEn ?? '',
			JSON.stringify(p.upgrades ?? []),
			JSON.stringify((p.fields ?? []).map(field)),
			p.universal ? 1 : 0,
			p.noShipping ? 0 : 1,
			p.featured ? 1 : 0,
			i,
			now + i,
			now + i
		]
	);
	const id = Number(row.id);
	for (const [j, v] of p.variants.entries()) {
		await run('INSERT INTO variants (product_id, sku, option_values, price, compare_at_price, stock, active, sort_order) VALUES (?,?,?,?,?,?,1,?)', [
			id,
			`${p.slug.replace('demo-', '').toUpperCase()}${v.values.length ? `-${v.values.join('-')}` : ''}`.slice(0, 40),
			JSON.stringify(v.values),
			v.price,
			v.compare ?? null,
			v.stock ?? 0,
			j
		]);
	}
	for (const slug of p.cats) {
		const c = await cat(slug);
		if (c) await run('INSERT INTO product_categories (product_id, category_id) VALUES (?,?)', [id, c]);
	}
	await run('INSERT INTO product_images (product_id, media_id, sort_order) VALUES (?,?,0)', [id, await image(p.image, p.title)]);
	for (const key of p.fits ?? []) if (modelIds[key]) await run('INSERT INTO product_bikes (product_id, model_id) VALUES (?,?)', [id, modelIds[key]]);
	created++;
}
console.log(`${created} Demo-Produkte und ${Object.keys(modelIds).length} Bike-Modelle angelegt.`);
