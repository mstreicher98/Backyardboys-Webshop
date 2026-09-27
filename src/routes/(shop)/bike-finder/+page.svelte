<script lang="ts">
	import { page } from '$app/state';
	import BikePicker from '$lib/components/shop/BikePicker.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
	const saved = $derived(page.data.bike as { label: string } | null);
</script>

<Seo title={i.tr('Bike-Finder', 'Bike finder')} description={i.tr('Finde Dekore, die auf dein Motorrad passen.', 'Find graphics that fit your motorcycle.')} />

<div class="wrap page-top section">
	<h1 class="display h1">{i.tr('Bike-Finder', 'Bike finder')}</h1>
	<p class="lead">
		{i.tr(
			'Wähle Marke, Modell und Baujahr. Wir merken uns dein Bike und zeigen dir im Shop nur passende Dekore – den Filter kannst du jederzeit abschalten.',
			"Choose brand, model and year. We'll remember your bike and show only matching graphics – you can turn the filter off any time."
		)}
	</p>

	{#if data.catalog.brands.length}
		<form method="POST" class="panel box">
			<BikePicker catalog={data.catalog} modelId={data.current?.modelId} year={data.current?.year} required />
			<button class="btn">{i.tr('Passende Dekore zeigen', 'Show matching graphics')}</button>
		</form>
		{#if saved}
			<form method="POST" action="?/vergessen" class="forget">
				<p class="muted">{i.tr('Gespeichert:', 'Saved:')} <strong>{saved.label}</strong></p>
				<button class="link">{i.tr('Bike vergessen', 'Forget bike')}</button>
			</form>
		{/if}
		<p class="muted small note">
			{i.tr('Dein Modell fehlt?', 'Your model is missing?')}
			<a class="link" href={i.href('/kategorie/full-custom')}>{i.tr('Full Custom passt auf jedes Bike', 'Full custom fits every bike')}</a>
			{i.tr('– oder', '– or')}
			<a class="link" href={i.href('/kontakt')}>{i.tr('frag uns', 'ask us')}</a>.
		</p>
	{:else}
		<p class="alert alert-info">{i.tr('Der Bike-Finder wird gerade befüllt. Schau bald wieder vorbei!', 'The bike finder is being filled. Check back soon!')}</p>
	{/if}
</div>

<style>
	.lead {
		margin: 0.75rem 0 2rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 56rem;
	}
	.box .btn {
		align-self: flex-start;
	}
	.forget {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}
	.note {
		margin-top: 1.5rem;
	}
</style>
