<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { getI18n } from '$lib/i18n.svelte';
	import { dur } from '$lib/motion';
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
	<div class="scrim" onclick={onClose} aria-hidden="true" out:fade={{ duration: dur(240) }}></div>
	<div class="panel-r" role="dialog" out:fly={{ x: 440, duration: dur(280), easing: cubicIn, opacity: 1 }} aria-modal="true" aria-label={i.tr('Warenkorb', 'Cart')}>
		<div class="top">
			<h2 class="h3">{i.tr('Warenkorb', 'Cart')}</h2>
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="icon-btn" aria-label={i.tr('Schließen', 'Close')} onclick={onClose} autofocus><X size={22} /></button>
		</div>
		{#if lines.length}
			<ul class="lines">
				{#each lines as l, n (l.id)}
					<li style="--i: {n}">
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
		-webkit-backdrop-filter: blur(4px);
		backdrop-filter: blur(4px);
		animation: fade-in 260ms var(--ease-out);
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
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
		box-shadow: -40px 0 80px -20px rgb(0 0 0 / 0.8);
		animation: slide 480ms var(--ease-expo);
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
		overflow-x: hidden;
		padding: 0.5rem 1.25rem;
	}
	.lines li {
		display: flex;
		gap: 0.9rem;
		padding-block: 0.9rem;
		border-bottom: 1px solid #18181b;
		animation: line-in 600ms var(--ease-expo) both;
		animation-delay: calc(140ms + var(--i, 0) * 55ms);
	}
	@keyframes line-in {
		from {
			opacity: 0;
			transform: translateX(2rem);
		}
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
		transition: color 160ms;
	}
	.t:hover {
		color: var(--s-accent);
	}
	.sum {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.25rem;
		border-top: 1px solid #27272a;
		animation: line-in 600ms var(--ease-expo) 220ms both;
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
		animation: line-in 600ms var(--ease-expo) 140ms both;
	}
</style>
