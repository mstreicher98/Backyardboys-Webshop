<script lang="ts">
	import OrderView from '$lib/components/shop/OrderView.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr(`Bestellung ${data.order.number}`, `Order ${data.order.number}`)} noindex />

<p class="back"><a class="link small" href={i.href('/konto')}>← {i.tr('Alle Bestellungen', 'All orders')}</a></p>
<OrderView v={data} {form} />

<style>
	.back {
		margin-bottom: 1rem;
	}
</style>
