<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('Gutschein prüfen', 'Check gift card')} />

<div class="wrap page-top section narrow">
	<h1 class="display h1">{i.tr('Gutschein prüfen', 'Check gift card')}</h1>
	<p class="lead">{i.tr('Gib deinen Code ein, um das Guthaben zu sehen. Eingelöst wird er im Warenkorb.', 'Enter your code to see the balance. Redeem it in your cart.')}</p>
	<form method="POST" class="row" use:enhance={() => async ({ update }) => update({ reset: false })}>
		<input class="input" name="code" placeholder="BYB-XXXX-XXXX" autocapitalize="characters" required value={form?.code ?? ''} aria-label={i.tr('Gutscheincode', 'Gift card code')} />
		<button class="btn">{i.tr('Prüfen', 'Check')}</button>
	</form>
	{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
	{#if form && 'balance' in form}
		<div class="panel result">
			<p class="muted">{form.code}</p>
			<p class="amount tabular">{i.money(form.balance ?? 0)}</p>
			<p class="muted small">{form.active ? i.tr(`von ursprünglich ${i.money(form.initial ?? 0)}`, `of originally ${i.money(form.initial ?? 0)}`) : i.tr('Dieser Gutschein ist nicht mehr aktiv.', 'This gift card is no longer active.')}</p>
		</div>
	{/if}
	<p class="more"><a class="link" href={i.href('/kategorie/gutscheine')}>{i.tr('Gutschein kaufen', 'Buy a gift card')}</a></p>
</div>

<style>
	.narrow {
		max-width: 40rem;
	}
	.lead {
		margin: 0.75rem 0 1.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	.alert,
	.result {
		margin-top: 1.25rem;
	}
	.amount {
		font-size: 2.2rem;
		font-weight: 800;
	}
	.more {
		margin-top: 1.5rem;
	}
</style>
