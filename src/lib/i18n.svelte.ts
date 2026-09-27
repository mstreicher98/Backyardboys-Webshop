import { getContext, setContext } from 'svelte';
import type { Locale } from '$lib/shop-types';

/**
 * Zweisprachigkeit des Shops. Deutsch ohne Präfix, Englisch unter /en/…
 * mit übersetzten Pfad-Teilen (/warenkorb ↔ /en/cart). Intern gibt es nur die
 * deutschen Routen – der reroute-Hook (src/hooks.ts) übersetzt zurück.
 *
 * Texte stehen direkt dort, wo sie gebraucht werden: tr('Warenkorb', 'Cart').
 */

export const LOCALES: Locale[] = ['de', 'en'];

const SEGMENTS: Record<string, string> = {
	produkte: 'products',
	kategorie: 'category',
	produkt: 'product',
	warenkorb: 'cart',
	kasse: 'checkout',
	konto: 'account',
	bestellungen: 'orders',
	bestellung: 'order',
	adressen: 'addresses',
	profil: 'profile',
	anmelden: 'login',
	registrieren: 'register',
	'passwort-vergessen': 'forgot-password',
	'neues-passwort': 'new-password',
	suche: 'search',
	kontakt: 'contact',
	zahlung: 'payment',
	gutschein: 'gift-card',
	haendler: 'dealers',
	bestaetigen: 'confirm',
	abmelden: 'logout',
	anmeldelink: 'login-link'
};
const REVERSE = Object.fromEntries(Object.entries(SEGMENTS).map(([de, en]) => [en, de]));

export function localeFromPath(pathname: string): Locale {
	return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de';
}

/** Interner (deutscher) Pfad → Adresse in der gewünschten Sprache */
export function localizePath(path: string, locale: Locale): string {
	if (locale === 'de') return path;
	const [pathname, rest = ''] = splitQuery(path);
	const mapped = pathname
		.split('/')
		.map((s) => SEGMENTS[s] ?? s)
		.join('/');
	return `/en${mapped === '/' ? '' : mapped}${rest}`;
}

/** Englische Adresse → interner Pfad */
export function delocalizePath(pathname: string): string {
	if (localeFromPath(pathname) === 'de') return pathname;
	const stripped = pathname.slice(3) || '/';
	return stripped
		.split('/')
		.map((s) => REVERSE[s] ?? s)
		.join('/');
}

function splitQuery(path: string): [string, string] {
	const i = path.search(/[?#]/);
	return i === -1 ? [path, ''] : [path.slice(0, i), path.slice(i)];
}

/** Aktuelle Seite in der anderen Sprache */
export function switchLocalePath(currentPathname: string, search: string, to: Locale): string {
	return localizePath(delocalizePath(currentPathname), to) + search;
}

/** Text in der Sprache wählen; englischer Text leer → deutscher */
export const pick = (locale: Locale, de: string, en: string | null | undefined) => (locale === 'en' && en ? en : de);

/* ------------------------------------------------------------ Kontext für Komponenten */

export class I18n {
	locale = $state<Locale>('de');

	constructor(locale: Locale) {
		this.locale = locale;
	}

	/** tr('Warenkorb', 'Cart') */
	tr = (de: string, en: string) => (this.locale === 'en' ? en : de);
	/** Datenbankfeld mit englischer Fassung, die leer sein kann */
	pick = (de: string, en: string | null | undefined) => pick(this.locale, de, en);
	/** Interner Pfad → Link in der aktuellen Sprache */
	href = (path: string) => localizePath(path, this.locale);

	money = (cents: number) => formatMoney(cents, this.locale);
	date = (d: Date | string | number) => formatDate(d, this.locale);
	dateTime = (d: Date | string | number) => formatDateTime(d, this.locale);
}

const KEY = Symbol('i18n');
export const setI18n = (i: I18n) => setContext(KEY, i);
export const getI18n = () => getContext<I18n>(KEY);

/* ------------------------------------------------------------ Formate */

const moneyFmt = {
	de: new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }),
	en: new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
};

export function formatMoney(cents: number, locale: Locale = 'de'): string {
	return moneyFmt[locale].format(cents / 100);
}

export function formatDate(d: Date | string | number, locale: Locale = 'de'): string {
	return new Date(d).toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-AT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' });
}

export function formatDateTime(d: Date | string | number, locale: Locale = 'de'): string {
	return new Date(d).toLocaleString(locale === 'en' ? 'en-GB' : 'de-AT', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Vienna'
	});
}
