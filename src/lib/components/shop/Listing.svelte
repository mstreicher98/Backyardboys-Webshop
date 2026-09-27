<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import X from '@lucide/svelte/icons/x';
	import { getI18n } from '$lib/i18n.svelte';
	import type { ProductCard as Card } from '$lib/server/shop/catalog';
	import ProductCard from './ProductCard.svelte';

	interface Props {
		products: Card[];
		total: number;
		page: number;
		pages: number;
		sort: string;
		q: string;
		bikeFilter: string | null;
		hasBike: boolean;
	}

	let { products, total, page: current, pages, sort, q, bikeFilter, hasBike }: Props = $props();
	const i = getI18n();

	function withParam(key: string, value: string | null) {
		const u = new URL(page.url);
		if (value == null) u.searchParams.delete(key);
		else u.searchParams.set(key, value);
		if (key !== 'seite') u.searchParams.delete('seite');
		return `${u.pathname}${u.search}`;
	}
</script>

<div class="bar">
	<p class="muted small">
		{total === 1 ? i.tr('1 Produkt', '1 product') : i.tr(`${total} Produkte`, `${total} products`)}
		{#if q}{i.tr(` für „${q}“`, ` for "${q}"`)}{/if}
	</p>
	<div class="filters">
		{#if bikeFilter}
			<a class="pill" href={withParam('alle', '1')} title={i.tr('Filter entfernen', 'Remove filter')}>
				{i.tr('Passend für', 'Fits')} {bikeFilter} <X size={14} />
			</a>
		{:else if hasBike}
			<a class="pill off" href={withParam('alle', null)}>{i.tr('Nur passende für mein Bike', 'Only for my bike')}</a>
		{/if}
		<label class="sort">
			<span class="sr-only">{i.tr('Sortierung', 'Sort')}</span>
			<select class="select" value={sort} onchange={(e) => goto(withParam('sortierung', e.currentTarget.value === 'empfohlen' ? null : e.currentTarget.value), { noScroll: true })}>
				<option value="empfohlen">{i.tr('Empfohlen', 'Featured')}</option>
				<option value="neu">{i.tr('Neueste', 'Newest')}</option>
				<option value="preis_auf">{i.tr('Preis aufsteigend', 'Price: low to high')}</option>
				<option value="preis_ab">{i.tr('Preis absteigend', 'Price: high to low')}</option>
			</select>
		</label>
	</div>
</div>

{#if products.length}
	<div class="grid">
		{#each products as p, n (p.id)}<ProductCard {p} eager={n < 4} />{/each}
	</div>
	{#if pages > 1}
		<nav class="pager" aria-label={i.tr('Seiten', 'Pages')}>
			{#each Array(pages) as _, n (n)}
				<a href={withParam('seite', n === 0 ? null : String(n + 1))} aria-current={n + 1 === current ? 'page' : undefined}>{n + 1}</a>
			{/each}
		</nav>
	{/if}
{:else}
	<div class="empty">
		<p class="h3">{i.tr('Nichts gefunden', 'Nothing found')}</p>
		<p class="muted">
			{bikeFilter
				? i.tr('Für dein Bike haben wir hier noch nichts – ein Full-Custom-Dekor passt immer.', "We don't have anything here for your bike yet – full custom graphics always fit.")
				: i.tr('Probier einen anderen Suchbegriff oder schau dich in den Kategorien um.', 'Try another search term or browse the categories.')}
		</p>
		<div class="empty-actions">
			{#if bikeFilter}<a class="btn btn-ghost" href={withParam('alle', '1')}>{i.tr('Alle Produkte zeigen', 'Show all products')}</a>{/if}
			<a class="btn" href={i.href('/kategorie/full-custom')}>{i.tr('Full Custom ansehen', 'See full custom')}</a>
		</div>
	</div>
{/if}

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.5rem;
		padding: 0 0.9rem;
		background: #fff;
		color: #000;
		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;
	}
	.pill.off {
		background: transparent;
		color: #fff;
		box-shadow: inset 0 0 0 1px #3f3f46;
	}
	.sort .select {
		min-height: 2.5rem;
		padding-block: 0.3rem;
		font-size: 0.9rem;
		width: auto;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.75rem 1rem;
	}
	@media (min-width: 768px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (min-width: 1280px) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2.25rem 1.5rem;
		}
	}
	.pager {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 2.5rem;
	}
	.pager a {
		display: grid;
		place-items: center;
		min-width: 2.6rem;
		height: 2.6rem;
		color: #fff;
		text-decoration: none;
		box-shadow: inset 0 0 0 1px #3f3f46;
		font-weight: 650;
	}
	.pager a[aria-current='page'] {
		background: #fff;
		color: #000;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 2.5rem 0;
	}
	.empty-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
</style>
