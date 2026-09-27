<script lang="ts">
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('Anmelden', 'Log in')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('Anmelden', 'Log in')}</h1>
	{#if data.valid}
		<p class="lead">{i.tr(`Anmelden als ${data.email}?`, `Log in as ${data.email}?`)}</p>
		<form method="POST"><button class="btn">{i.tr('Jetzt anmelden', 'Log in now')}</button></form>
	{:else}
		<p class="alert alert-error lead">{i.tr('Der Link ist abgelaufen oder wurde schon verwendet.', 'The link has expired or was already used.')}</p>
		<a class="btn" href={i.href('/konto/anmelden')}>{i.tr('Neuen Link anfordern', 'Request a new link')}</a>
	{/if}
</div>

<style>
	.auth {
		max-width: 34rem;
	}
	.lead {
		margin: 1rem 0 1.5rem;
	}
</style>
