<script lang="ts">
	import { page } from '$app/state';
	import { delocalizePath, localeFromPath, localizePath } from '$lib/i18n.svelte';

	interface Props {
		title: string;
		description?: string;
		image?: string | null;
		type?: 'website' | 'product';
		noindex?: boolean;
	}

	let { title, description = '', image = null, type = 'website', noindex = false }: Props = $props();

	const SITE = 'Backyardboys Design';
	const full = $derived(title === SITE ? title : `${title} | ${SITE}`);
	const abs = (p: string) => (p.startsWith('http') ? p : `${page.url.origin}${p}`);
	const internal = $derived(delocalizePath(page.url.pathname));
	const canonical = $derived(`${page.url.origin}${page.url.pathname}`);
	const en = $derived(localeFromPath(page.url.pathname) === 'en');
</script>

<svelte:head>
	<title>{full}</title>
	{#if description}<meta name="description" content={description.slice(0, 300)} />{/if}
	<link rel="canonical" href={canonical} />
	<link rel="alternate" hreflang="de" href={`${page.url.origin}${internal}`} />
	<link rel="alternate" hreflang="en" href={`${page.url.origin}${localizePath(internal, 'en')}`} />
	<link rel="alternate" hreflang="x-default" href={`${page.url.origin}${internal}`} />
	{#if noindex}<meta name="robots" content="noindex" />{/if}
	<meta property="og:site_name" content={SITE} />
	<meta property="og:locale" content={en ? 'en_GB' : 'de_AT'} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	{#if description}<meta property="og:description" content={description.slice(0, 300)} />{/if}
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={abs(image ?? '/bilder/vorschau.jpg')} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
