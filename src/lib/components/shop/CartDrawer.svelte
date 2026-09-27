<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { getI18n } from '$lib/i18n.svelte';
	import type { MediaRef } from '$lib/media';
	import Picture from './Picture.svelte';

	interface Line {
		id: number;
		slug: string;
		title: string;
		variantTitle: string;
		image: MediaRef | null;
		quantity: number;
		lineTotal: number;
		isDeposit: boolean;
	}

	interface Props {
		open: boolean;
		lines: Line[];
		total: number;
		onClose: () => void;
	}

	let { open, lines, total, onClose }: Props = $props();
	const i = getI18n();
</script>

{#if open}
	<div class="scrim" onclick={onClose} aria-hidden="true"></div>
	<div class="panel-r" role="dialog" aria-modal="true" aria-label={i.tr('Warenkorb', 'Cart')}>
		<div class="top">
			<h2 class="h3">{i.tr('Warenkorb', 'Cart')}</h2>
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="icon-btn" aria-label={i.tr('Schließen', 'Close')} onclick={onClose} autofocus><X size={22} /></button>
		</div>
		{#if lines.length}
			<ul class="lines">
				{#each lines as l (l.id)}
					<li>
						<a href={i.href(`/produkt/${l.slug}`)} class="img" onclick={onClose}>
							{#if l.image}<Picture media={l.image} sizes="96px" want={400} alt="" />{/if}
						</a>
						<div class="info">
							<a href={i.href(`/produkt/${l.slug}`)} class="t" onclick={onClose}>{l.title}</a>
							{#if l.variantTitle}<span class="muted small">{l.variantTitle}</span>{/if}
							{#if l.isDeposit}<span class="muted small">{i.tr('Anzahlung', 'Deposit')}</span>{/if}
							<span class="muted small">{l.quantity} × · {i.money(l.lineTotal)}</span>
						</div>
					</li>
				{/each}
			</ul>
			<div class="sum">
				<div class="row"><span>{i.tr('Zwischensumme', 'Subtotal')}</span><strong>{i.money(total)}</strong></div>
				<p class="muted small">{i.tr('Versand und Rabatte berechnen wir an der Kasse.', 'Shipping and discounts are calculated at checkout.')}</p>
				<a href={i.href('/kasse')} class="btn btn-block" onclick={onClose}>{i.tr('Zur Kasse', 'Checkout')}</a>
				<a href={i.href('/warenkorb')} class="btn btn-ghost btn-block" onclick={onClose}>{i.tr('Warenkorb bearbeiten', 'Edit cart')}</a>
			</div>
		{:else}
			<div class="empty">
				<p>{i.tr('Dein Warenkorb ist leer.', 'Your cart is empty.')}</p>
				<a href={i.href('/kategorie/bike-designs')} class="btn" onclick={onClose}>{i.tr('Dekore ansehen', 'Browse graphics')}</a>
			</div>
		{/if}
	</div>
{/if}

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && onClose()} />

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 0.7);
	}
	.panel-r {
		position: fixed;
		z-index: 61;
		top: 0;
		right: 0;
		bottom: 0;
		width: min(26rem, 92vw);
		display: flex;
		flex-direction: column;
		background: #0c0c0e;
		border-left: 1px solid #27272a;
		animation: slide 220ms var(--ease-out);
	}
	@keyframes slide {
		from {
			transform: translateX(100%);
		}
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1rem 1rem 1.25rem;
		border-bottom: 1px solid #27272a;
	}
	.lines {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 1.25rem;
	}
	.lines li {
		display: flex;
		gap: 0.9rem;
		padding-block: 0.9rem;
		border-bottom: 1px solid #18181b;
	}
	.img {
		flex-shrink: 0;
		width: 5.5rem;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
	}
	.img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.t {
		color: #fff;
		font-weight: 700;
		text-decoration: none;
		line-height: 1.3;
	}
	.sum {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.25rem;
		border-top: 1px solid #27272a;
	}
	.row {
		display: flex;
		justify-content: space-between;
		font-size: 1.05rem;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem 1.25rem;
	}
</style>
