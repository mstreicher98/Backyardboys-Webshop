<script lang="ts">
	import { expoOut } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import { getI18n } from '$lib/i18n.svelte';
	import { dur } from '$lib/motion';
	import type { CategoryNode } from '$lib/server/shop/catalog';
	import Picture from './Picture.svelte';

	/**
	 * Aufklappmenü einer Hauptkategorie: links die Unterkategorien als große Schrift,
	 * rechts eine Vorschau der Kategorie, auf die gerade gezeigt wird.
	 */
	let { category }: { category: CategoryNode } = $props();
	const i = getI18n();

	let activeId = $state<number | null>(null);
	const active = $derived(category.children.find((c) => c.id === activeId) ?? category.children[0]);
	const preview = $derived(active?.image ?? category.image);

	// Verlaufs-Marker gleitet zur gewählten Zeile
	// Maß an den Listenpunkten: deren Bezug ist .list (die Links liegen in animierten Punkten)
	let rows = $state<HTMLLIElement[]>([]);
	const marker = $derived.by(() => {
		const n = category.children.indexOf(active);
		const el = rows[n];
		// etwas kürzer als die Zeile, damit der Strich nur neben der Schrift steht
		return el ? { y: el.offsetTop + 12, h: el.offsetHeight - 24 } : null;
	});

	/** Neue Vorschau wischt schräg über die alte (gleiche Kante wie beim Titelbild) */
	function wipe(_node: Element) {
		return {
			duration: dur(650),
			easing: expoOut,
			css: (t: number) => {
				const a = -15 + 130 * t;
				return `clip-path: polygon(-15% 0, ${a}% 0, ${a - 15}% 100%, -15% 100%)`;
			}
		};
	}
</script>

<div class="in wrap">
	<div class="list">
		{#if marker}<span class="marker" aria-hidden="true" style:transform="translateY({marker.y}px) skewX(-12deg)" style:height="{marker.h}px"></span>{/if}
		<ul>
			{#each category.children as child, n (child.id)}
				<li style="--i: {n}" bind:this={rows[n]}>
					<a
						class="row"
						class:on={child === active}
						href={i.href(`/kategorie/${child.slug}`)}
						onmouseenter={() => (activeId = child.id)}
						onfocus={() => (activeId = child.id)}
					>
						<span class="name">{child.name}</span>
						{#if child.tagline}<span class="tag">{child.tagline}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
		<a class="all link" href={i.href(`/kategorie/${category.slug}`)}>{i.tr(`Alle ${category.name} anzeigen`, `View all ${category.name}`)}</a>
	</div>

	<a class="preview" href={i.href(`/kategorie/${active?.slug ?? category.slug}`)} tabindex="-1" aria-hidden="true">
		{#key active?.id}
			<span class="shot" in:wipe out:fade={{ duration: dur(500) }}>
				{#if preview}
					<Picture media={preview} sizes="32rem" want={800} alt="" />
				{:else}
					<span class="ph">BYB</span>
				{/if}
			</span>
		{/key}
		<span class="caption">
			{#key active?.id}<span class="cap-name">{active?.name ?? category.name}</span>{/key}
		</span>
	</a>
</div>

<style>
	.in {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
		gap: 3rem;
		align-items: center;
		padding-block: 2.25rem 2.5rem;
	}

	/* ---------------- Liste */
	.list {
		position: relative;
		padding-left: 1.75rem;
	}
	.marker {
		position: absolute;
		top: 0;
		left: 0;
		width: 0.4rem;
		background: var(--grad);
		box-shadow: var(--glow);
		transition:
			transform 450ms var(--ease-expo),
			height 450ms var(--ease-expo);
		animation: marker-in 500ms var(--ease-expo) 120ms both;
	}
	@keyframes marker-in {
		from {
			opacity: 0;
		}
	}
	ul {
		display: flex;
		flex-direction: column;
	}
	li {
		border-bottom: 1px solid #18181b;
		animation: row-in 560ms var(--ease-expo) both;
		animation-delay: calc(60ms + var(--i) * 55ms);
	}
	@keyframes row-in {
		from {
			opacity: 0;
			transform: translateY(0.9rem);
		}
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.9rem 0;
		color: #71717a;
		text-decoration: none;
		transition: color 260ms var(--ease-out);
	}
	.row:hover,
	.row.on {
		color: #fff;
	}
	.row:focus-visible {
		outline-offset: 4px;
	}
	.name {
		font-size: clamp(1.5rem, 0.6rem + 1.4vw, 2.3rem);
		font-weight: 800;
		font-stretch: 125%;
		text-transform: uppercase;
		line-height: 1;
		letter-spacing: -0.01em;
		transition: transform 450ms var(--ease-expo);
	}
	.row.on .name {
		transform: translateX(0.4rem);
	}
	.tag {
		font-size: 0.85rem;
		font-weight: 600;
		color: #71717a;
		transition:
			color 260ms,
			transform 450ms var(--ease-expo);
	}
	.row.on .tag {
		color: #a1a1aa;
		transform: translateX(0.4rem);
	}
	.all {
		display: inline-block;
		margin-top: 1.25rem;
		font-size: 0.9rem;
		animation: row-in 560ms var(--ease-expo) 260ms both;
	}

	/* ---------------- Vorschau */
	.preview {
		position: relative;
		display: block;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
		clip-path: polygon(0 0, 100% 0, 100% calc(100% - 2rem), calc(100% - 2rem) 100%, 0 100%);
		animation: preview-in 700ms var(--ease-expo) 80ms both;
	}
	@keyframes preview-in {
		from {
			opacity: 0;
			transform: translateX(1.5rem);
		}
	}
	.shot {
		position: absolute;
		inset: 0;
	}
	.shot :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: settle 1100ms var(--ease-expo) both;
		transition: transform 700ms var(--ease-expo);
	}
	@keyframes settle {
		from {
			transform: scale(1.08);
		}
	}
	.preview:hover .shot :global(img) {
		transform: scale(1.03);
	}
	.ph {
		display: grid;
		place-items: center;
		height: 100%;
		color: #3f3f46;
		font-size: 3rem;
		font-weight: 850;
		font-stretch: 125%;
	}
	.caption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 2.5rem 1.25rem 1rem;
		background: linear-gradient(to top, rgb(0 0 0 / 0.75), transparent);
		pointer-events: none;
	}
	.cap-name {
		display: block;
		color: #fff;
		font-weight: 750;
		font-stretch: 112%;
		text-transform: uppercase;
		animation: cap-in 500ms var(--ease-expo) 120ms both;
	}
	@keyframes cap-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
	}
</style>
