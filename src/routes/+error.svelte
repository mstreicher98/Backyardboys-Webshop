<script lang="ts">
	import { page } from '$app/state';
	import { localeFromPath } from '$lib/i18n.svelte';

	const en = $derived(localeFromPath(page.url.pathname) === 'en');
</script>

<svelte:head><title>{page.status === 404 ? (en ? 'Not found' : 'Nicht gefunden') : en ? 'Error' : 'Fehler'} | Backyardboys Design</title></svelte:head>

<main class="err">
	<img src="/bilder/logo.webp" alt="Backyardboys Design" width="600" height="254" />
	<p class="code">{page.status}</p>
	<h1>{page.error?.message ?? (en ? 'Something went wrong.' : 'Da ist etwas schiefgelaufen.')}</h1>
	<a href={en ? '/en' : '/'}>{en ? 'Back to the shop' : 'Zurück zum Shop'}</a>
</main>

<style>
	.err {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
		background: #000;
		color: #fafafa;
	}
	img {
		width: 9rem;
		height: auto;
		margin-bottom: 1rem;
	}
	.code {
		font-size: 5rem;
		font-weight: 850;
		font-stretch: 125%;
		line-height: 1;
	}
	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #d4d4d8;
	}
	a {
		margin-top: 1.25rem;
		padding: 0.8rem 1.4rem;
		background: #fff;
		color: #000;
		font-weight: 750;
		text-transform: uppercase;
		text-decoration: none;
		letter-spacing: 0.03em;
	}
</style>
