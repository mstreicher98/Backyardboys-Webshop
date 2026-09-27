import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { generatePassword, hashPassword } from '../auth';
import { storeImage } from '../media';
import { db } from './index';
import { bikeBrands, categories, pages, shippingCountries, upgradeGroups, upgradeOptions, users } from './schema';
import { SEED_PAGES } from './seed-pages';

const count = async (table: typeof users | typeof categories | typeof pages | typeof upgradeGroups | typeof shippingCountries | typeof bikeBrands) =>
	Number((await db.select({ n: sql<number>`count(*)` }).from(table).get())?.n ?? 0);

/** Grunddaten für eine brandneue Installation – bestehende Daten bleiben unberührt */
export async function bootstrap() {
	if ((await count(users)) === 0) await createInitialAdmin();
	if ((await count(shippingCountries)) === 0) await seedCountries();
	if ((await count(pages)) === 0) for (const p of SEED_PAGES) await db.insert(pages).values(p);
	if ((await count(bikeBrands)) === 0) await seedBrands();
	if ((await count(categories)) === 0) await seedCategories();
	if ((await count(upgradeGroups)) === 0) await seedUpgrades();
}

async function createInitialAdmin() {
	const username = (env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
	const fromEnv = env.INITIAL_ADMIN_PASSWORD;
	const password = fromEnv || (dev ? 'byb-admin-2026' : generatePassword(16));
	await db.insert(users).values({
		username,
		name: env.INITIAL_ADMIN_NAME || 'Administrator',
		email: env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || null,
		role: 'admin',
		owner: true,
		passwordHash: await hashPassword(password),
		mustChangePassword: !dev
	});
	const line = '─'.repeat(60);
	console.info(
		`\n${line}\n  Erster Admin-Zugang angelegt\n  Adresse:      /admin\n  Benutzername: ${username}\n  Passwort:     ${fromEnv ? '(aus INITIAL_ADMIN_PASSWORD)' : password}\n  Beim ersten Login werden ein neues Passwort und die\n  Zwei-Faktor-Anmeldung (Authenticator-App) eingerichtet.\n${line}\n`
	);
}

/** Bilder aus seed/ in die Mediathek übernehmen (fehlt die Datei, bleibt das Bild leer) */
async function seedImage(rel: string, alt: string): Promise<number | null> {
	const file = path.resolve('seed', rel);
	if (!fs.existsSync(file)) return null;
	try {
		const m = await storeImage(fs.readFileSync(file), path.basename(file), null);
		if (alt) await db.run(sql`UPDATE media SET alt = ${alt} WHERE id = ${m.id}`);
		return m.id;
	} catch (err) {
		console.error('[grunddaten]', rel, err);
		return null;
	}
}

async function seedCategories() {
	type C = { slug: string; name: string; nameEn: string; tagline: string; taglineEn: string; image?: string; children?: Omit<C, 'children'>[] };
	const tree: C[] = [
		{
			slug: 'bike-designs',
			name: 'Bike Designs',
			nameEn: 'Bike designs',
			tagline: 'Dekor-Kits',
			taglineEn: 'Graphics kits',
			image: 'kategorien/bike-graphics.webp',
			children: [
				{ slug: 'full-custom', name: 'Full Custom Design', nameEn: 'Full custom design', tagline: 'Dein eigenes Design', taglineEn: 'Your own design', image: 'kategorien/full-custom.webp' },
				{ slug: 'semi-custom', name: 'Semi Custom Designs', nameEn: 'Semi custom designs', tagline: 'Vorlage, personalisiert', taglineEn: 'Template, personalised', image: 'kategorien/semi-custom.webp' },
				{ slug: 'reprint', name: 'Reprint', nameEn: 'Reprint', tagline: 'Dein Dekor nochmal', taglineEn: 'Your graphics again', image: 'kategorien/reprint-graphics.webp' }
			]
		},
		{
			slug: 'clothing',
			name: 'Clothing',
			nameEn: 'Clothing',
			tagline: 'Streetwear',
			taglineEn: 'Streetwear',
			image: 'kategorien/clothing.webp',
			children: [
				{ slug: 't-shirts', name: 'T-Shirts', nameEn: 'T-shirts', tagline: 'Streetwear', taglineEn: 'Streetwear', image: 'kategorien/shirt.webp' },
				{ slug: 'hoodies', name: 'Hoodies', nameEn: 'Hoodies', tagline: 'Streetwear', taglineEn: 'Streetwear', image: 'kategorien/hoodie.webp' }
			]
		},
		{
			slug: 'accessories',
			name: 'Accessories',
			nameEn: 'Accessories',
			tagline: 'Sticker, Duft & mehr',
			taglineEn: 'Stickers, scents & more',
			image: 'kategorien/accessories.webp',
			children: [
				{ slug: 'sticker', name: 'Sticker', nameEn: 'Stickers', tagline: 'Premium Sticker', taglineEn: 'Premium stickers', image: 'kategorien/sticker.webp' },
				{ slug: 'air-freshener', name: 'Air Freshener', nameEn: 'Air fresheners', tagline: 'Premium Aromas', taglineEn: 'Premium scents', image: 'kategorien/air-freshener.webp' },
				{ slug: 'gutscheine', name: 'Gutscheine', nameEn: 'Gift cards', tagline: 'Zum Verschenken', taglineEn: 'To give away', image: 'kategorien/giftcard.webp' }
			]
		},
		{ slug: 'bike-pflege', name: 'Bike Pflege', nameEn: 'Bike care', tagline: 'Reinigen & Schützen', taglineEn: 'Clean & protect' }
	];
	for (const [i, c] of tree.entries()) {
		const mediaId = c.image ? await seedImage(c.image, c.name) : null;
		const parent = await db
			.insert(categories)
			.values({ slug: c.slug, name: c.name, nameEn: c.nameEn, tagline: c.tagline, taglineEn: c.taglineEn, mediaId, sortOrder: i })
			.returning()
			.get();
		for (const [j, ch] of (c.children ?? []).entries()) {
			const childMedia = ch.image ? await seedImage(ch.image, ch.name) : null;
			await db.insert(categories).values({ slug: ch.slug, name: ch.name, nameEn: ch.nameEn, tagline: ch.tagline, taglineEn: ch.taglineEn, mediaId: childMedia, parentId: parent.id, sortOrder: j });
		}
	}
}

async function seedUpgrades() {
	const groups = [
		{
			name: 'Premium Base',
			nameEn: 'Premium base',
			options: [
				['Regular', 'Regular', 'upgrades/premium-base-regular.webp', true],
				['Full Chrome', 'Full chrome', 'upgrades/premium-base-chrome.webp', false],
				['Full Holographic Chrome', 'Full holographic chrome', 'upgrades/premium-base-holographic.webp', false]
			] as const
		},
		{
			name: 'Premium Finish',
			nameEn: 'Premium finish',
			options: [
				['Glossy', 'Glossy', 'upgrades/premium-finish-glossy.webp', true],
				['Matte', 'Matte', 'upgrades/premium-finish-matte.webp', false],
				['Holographic Glitter', 'Holographic glitter', 'upgrades/premium-finish-glitter.webp', false]
			] as const
		}
	];
	for (const [i, g] of groups.entries()) {
		const group = await db.insert(upgradeGroups).values({ name: g.name, nameEn: g.nameEn, sortOrder: i }).returning().get();
		for (const [j, [name, nameEn, image, isDefault]] of g.options.entries()) {
			// Aufpreise legt das Team im Admin fest (Dekore → Upgrades)
			await db.insert(upgradeOptions).values({ groupId: group.id, name, nameEn, surcharge: 0, isDefault, sortOrder: j, mediaId: await seedImage(image, name) });
		}
	}
}

async function seedBrands() {
	const brands = ['KTM', 'Husqvarna', 'GasGas', 'Yamaha', 'Honda', 'Kawasaki', 'Suzuki', 'Beta', 'Sherco', 'TM Racing', 'Fantic', 'Triumph', 'Stark Future'];
	for (const [i, name] of brands.entries()) {
		await db.insert(bikeBrands).values({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), sortOrder: i });
	}
}

/** EU-Länder mit Normalsteuersatz (für OSS) und die häufigsten Nachbarn außerhalb der EU */
async function seedCountries() {
	const rows: [string, string, string, boolean, number][] = [
		['AT', 'Österreich', 'Austria', true, 2000],
		['DE', 'Deutschland', 'Germany', true, 1900],
		['IT', 'Italien', 'Italy', true, 2200],
		['CH', 'Schweiz', 'Switzerland', false, 0],
		['LI', 'Liechtenstein', 'Liechtenstein', false, 0],
		['SI', 'Slowenien', 'Slovenia', true, 2200],
		['HU', 'Ungarn', 'Hungary', true, 2700],
		['SK', 'Slowakei', 'Slovakia', true, 2300],
		['CZ', 'Tschechien', 'Czechia', true, 2100],
		['HR', 'Kroatien', 'Croatia', true, 2500],
		['PL', 'Polen', 'Poland', true, 2300],
		['NL', 'Niederlande', 'Netherlands', true, 2100],
		['BE', 'Belgien', 'Belgium', true, 2100],
		['LU', 'Luxemburg', 'Luxembourg', true, 1700],
		['FR', 'Frankreich', 'France', true, 2000],
		['ES', 'Spanien', 'Spain', true, 2100],
		['PT', 'Portugal', 'Portugal', true, 2300],
		['DK', 'Dänemark', 'Denmark', true, 2500],
		['SE', 'Schweden', 'Sweden', true, 2500],
		['FI', 'Finnland', 'Finland', true, 2550],
		['IE', 'Irland', 'Ireland', true, 2300],
		['GR', 'Griechenland', 'Greece', true, 2400],
		['RO', 'Rumänien', 'Romania', true, 2100],
		['BG', 'Bulgarien', 'Bulgaria', true, 2000],
		['EE', 'Estland', 'Estonia', true, 2400],
		['LV', 'Lettland', 'Latvia', true, 2100],
		['LT', 'Litauen', 'Lithuania', true, 2100],
		['CY', 'Zypern', 'Cyprus', true, 1900],
		['MT', 'Malta', 'Malta', true, 1800],
		['GB', 'Vereinigtes Königreich', 'United Kingdom', false, 0],
		['NO', 'Norwegen', 'Norway', false, 0]
	];
	for (const [i, [code, name, nameEn, eu, vatRate]] of rows.entries()) {
		// Aktiv sind zu Beginn nur Österreich und Deutschland – Preise im Admin anpassen
		const active = code === 'AT' || code === 'DE';
		await db.insert(shippingCountries).values({ code, name, nameEn, eu, vatRate, active, price: code === 'AT' ? 690 : code === 'DE' ? 1290 : 1590, sortOrder: i });
	}
}
