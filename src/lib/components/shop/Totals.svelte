<script lang="ts">
	import { getI18n } from '$lib/i18n.svelte';
	import type { Totals } from '$lib/server/shop/pricing';

	let { t, discountCode = null, country = '' }: { t: Totals; discountCode?: string | null; country?: string } = $props();
	const i = getI18n();

	const taxNote = $derived(
		t.taxCase === 'kleinunternehmer'
			? i.tr('Keine USt. (Kleinunternehmerregelung)', 'No VAT (small business regulation)')
			: t.taxCase === 'reverse_charge'
				? i.tr('Nettopreise – Reverse Charge', 'Net prices – reverse charge')
				: t.taxCase === 'export'
					? i.tr('Nettopreise – Ausfuhrlieferung', 'Net prices – export delivery')
					: i.tr(`inkl. ${(t.taxRate / 100).toLocaleString('de-AT')} % USt.`, `incl. ${(t.taxRate / 100).toLocaleString('en-GB')}% VAT`)
	);
</script>

<dl class="totals tabular">
	<div><dt>{i.tr('Zwischensumme', 'Subtotal')}</dt><dd>{i.money(t.subtotal)}</dd></div>
	{#if t.discount > 0}<div class="minus"><dt>{i.tr('Rabatt', 'Discount')}{discountCode ? ` (${discountCode})` : ''}</dt><dd>−{i.money(t.discount)}</dd></div>{/if}
	{#if t.shippingMethod !== 'keiner'}
		<div>
			<dt>{t.shippingMethod === 'abholung' ? i.tr('Abholung', 'Pickup') : i.tr('Versand', 'Shipping')}{country && t.shippingMethod === 'versand' ? ` (${country})` : ''}</dt>
			<dd>{t.shipping === 0 ? i.tr('kostenlos', 'free') : i.money(t.shipping)}</dd>
		</div>
	{/if}
	<div class="sum"><dt>{i.tr('Summe', 'Total')}</dt><dd>{i.money(t.total)}</dd></div>
	{#if t.taxTotal > 0}<div class="note"><dt>{taxNote}</dt><dd>{i.money(t.taxTotal)}</dd></div>{:else}<div class="note"><dt>{taxNote}</dt></div>{/if}
	{#if t.giftCardTotal > 0}
		<div class="minus"><dt>{i.tr('Gutschein', 'Gift card')}</dt><dd>−{i.money(t.giftCardTotal)}</dd></div>
		<div class="sum"><dt>{i.tr('Zu zahlen', 'To pay')}</dt><dd>{i.money(t.amountDue)}</dd></div>
	{/if}
</dl>

<style>
	.totals {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.totals div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	dt {
		color: #d4d4d8;
	}
	.minus dd {
		color: #86efac;
	}
	.sum {
		margin-top: 0.4rem;
		padding-top: 0.75rem;
		border-top: 1px solid #3f3f46;
		font-size: 1.2rem;
		font-weight: 800;
	}
	.sum dt {
		color: #fff;
	}
	.note {
		font-size: 0.8rem;
	}
	.note dt,
	.note dd {
		color: #a1a1aa;
	}
</style>
