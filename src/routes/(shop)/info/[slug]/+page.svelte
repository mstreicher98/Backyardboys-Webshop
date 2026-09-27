<script lang="ts">
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';
	import { htmlText } from '$lib/text';

	let { data } = $props();
	const i = getI18n();
</script>

<Seo title={data.title} description={htmlText(data.html).slice(0, 160)} />

<article class="wrap page-top section">
	<h1 class="display h1">{data.title}</h1>
	<div class="prose body">{@html data.html}</div>
	{#if data.legal}<p class="muted small stamp">{i.tr('Stand', 'Last updated')}: {i.date(data.updatedAt)}</p>{/if}
</article>

<style>
	.body {
		margin-top: 2rem;
	}
	.stamp {
		margin-top: 2.5rem;
	}
</style>
