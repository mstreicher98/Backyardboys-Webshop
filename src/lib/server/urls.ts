import { env } from '$env/dynamic/private';
import { localizePath } from '$lib/i18n.svelte';
import type { Locale } from '$lib/shop-types';

/**
 * Öffentliche Adressen für Links in E-Mails und Zahlungs-Rücksprünge.
 * SHOP_URL  z. B. https://shop.backyardboys.at
 * ADMIN_URL z. B. https://admin.backyardboys.at
 * Ohne Angabe (Entwicklung) läuft beides unter http://localhost:5190.
 */
const trim = (s: string) => s.replace(/\/+$/, '');

export const shopBase = () => trim(env.SHOP_URL || 'http://localhost:5190');
export const adminBase = () => trim(env.ADMIN_URL || env.SHOP_URL || 'http://localhost:5190');

export const shopUrl = (path: string, locale: Locale = 'de') => `${shopBase()}${localizePath(path, locale)}`;
export const adminUrl = (path: string) => `${adminBase()}${path}`;

/** Hostnamen für die Trennung shop./admin. – null, wenn nicht getrennt */
export function hosts(): { shop: string; admin: string } | null {
	try {
		const shop = new URL(shopBase()).host;
		const admin = new URL(adminBase()).host;
		return shop !== admin ? { shop, admin } : null;
	} catch {
		return null;
	}
}
