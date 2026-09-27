import type { Reroute } from '@sveltejs/kit';
import { delocalizePath, localeFromPath } from '$lib/i18n.svelte';

/** /en/cart → Route /warenkorb (die Sprache liest hooks.server.ts aus der Adresse) */
export const reroute: Reroute = ({ url }) => {
	if (localeFromPath(url.pathname) === 'en') return delocalizePath(url.pathname);
};
