<script lang="ts">
	import { getI18n } from '$lib/i18n.svelte';
	import type { ProductCard } from '$lib/server/shop/catalog';
	import Picture from './Picture.svelte';

	let { p, eager = false }: { p: ProductCard; eager?: boolean } = $props();
	const i = getI18n();

	const dekorLabel = $derived(
		p.dekorType === 'full_custom' ? 'Full Custom' : p.dekorType === 'semi_custom' ? 'Semi Custom' : p.dekorType === 'reprint' ? 'Reprint' : null
	);
</script>

<a class="card" href={i.href(`/produkt/${p.slug}`)}>
	<span class="img" class:has2={!!p.image2}>
		{#if p.image}
			<Picture media={p.image} sizes="(min-width: 1024px) 25vw, 50vw" want={800} alt="" {eager} />
			{#if p.image2}<span class="img2"><Picture media={p.image2} sizes="(min-width: 1024px) 25vw, 50vw" want={800} alt="" /></span>{/if}
		{:else}
			<span class="ph" aria-hidden="true">BYB</span>
		{/if}
		<span class="tags">
			{#if p.soldOut}<span class="badge badge-dark">{i.tr('Ausverkauft', 'Sold out')}</span>{/if}
			{#if p.preorder}<span class="badge">{i.tr('Vorbestellung', 'Pre-order')}</span>{/if}
			{#if p.compareAt && p.compareAt > p.priceFrom}<span class="badge">{i.tr('Angebot', 'Sale')}</span>{/if}
		</span>
	</span>
	<span class="body">
		{#if dekorLabel}<span class="kind">{dekorLabel}</span>{/if}
		<span class="title">{p.title}</span>
		{#if p.subtitle}<span class="sub">{p.subtitle}</span>{/if}
		<span class="price">
			{#if p.dekorType === 'full_custom'}{i.tr('Anzahlung', 'Deposit')}{/if}
			{#if p.multiplePrices}{i.tr('ab', 'from')}{/if}
			<strong>{i.money(p.priceFrom)}</strong>
			{#if p.compareAt && p.compareAt > p.priceFrom}<s>{i.money(p.compareAt)}</s>{/if}
		</span>
	</span>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		color: #fff;
		text-decoration: none;
	}
	.img {
		position: relative;
		display: block;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
		clip-path: polygon(0 0, 100% 0, 100% calc(100% - 1.25rem), calc(100% - 1.25rem) 100%, 0 100%);
	}
	.img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.img2 {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 200ms;
	}
	@media (hover: hover) {
		.card:hover .img2 {
			opacity: 1;
		}
	}
	.ph {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: #3f3f46;
		font-size: 2rem;
		font-weight: 850;
		font-stretch: 125%;
	}
	.tags {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		display: flex;
		gap: 0.35rem;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding-top: 0.8rem;
	}
	.kind {
		font-size: 0.75rem;
		font-weight: 650;
		color: #a1a1aa;
	}
	.title {
		font-weight: 750;
		font-stretch: 108%;
		text-transform: uppercase;
		line-height: 1.2;
		letter-spacing: 0.01em;
	}
	.card:hover .title {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.sub {
		font-size: 0.875rem;
		color: #a1a1aa;
	}
	.price {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
		margin-top: 0.3rem;
		font-size: 0.9rem;
		color: #d4d4d8;
	}
	.price strong {
		color: #fff;
		font-size: 1rem;
	}
	s {
		color: #71717a;
	}
</style>
