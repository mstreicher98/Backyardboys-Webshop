<script lang="ts">
	import OrderView from '$lib/components/shop/OrderView.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr(`Bestellung ${data.order.number}`, `Order ${data.order.number}`)} noindex />

<div class="wrap page-top section">
	<OrderView v={data} {form} paymentError={data.paymentError} />
</div>
