<script lang="ts">
	import Listing from '$lib/components/shop/Listing.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
	const title = $derived(data.q ? i.tr(`Suche: ${data.q}`, `Search: ${data.q}`) : i.tr('Alle Produkte', 'All products'));
</script>

<Seo {title} noindex={!!data.q} />

<div class="wrap page-top section">
	<h1 class="display h1">{title}</h1>
	<form class="search" method="GET" role="search">
		<input class="input" type="search" name="q" value={data.q} placeholder={i.tr('Dekor, Shirt, Modell …', 'Graphics, shirt, model …')} aria-label={i.tr('Suchbegriff', 'Search term')} />
		<button class="btn">{i.tr('Suchen', 'Search')}</button>
	</form>
	<Listing {...data} />
</div>

<style>
	.search {
		display: flex;
		gap: 0.5rem;
		max-width: 36rem;
		margin: 1.5rem 0 2rem;
	}
</style>
