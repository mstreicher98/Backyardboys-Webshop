<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import X from '@lucide/svelte/icons/x';
	import { flip } from 'svelte/animate';
	import { mediaSrc, type MediaRef } from '$lib/media';
	import MediaLibrary from './MediaLibrary.svelte';

	/** Mehrere Bilder mit Reihenfolge – per Ziehen oder mit den Pfeilen */
	let { name, label = 'Bilder', value = $bindable([]) }: { name: string; label?: string; value: MediaRef[] } = $props();

	let open = $state(false);
	let dragIndex = $state<number | null>(null);

	function add(items: MediaRef[]) {
		const have = new Set(value.map((v) => v.id));
		value = [...value, ...items.filter((i) => !have.has(i.id))];
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= value.length || from === to) return;
		const next = [...value];
		const [it] = next.splice(from, 1);
		next.splice(to, 0, it);
		value = next;
	}
	const remove = (i: number) => (value = value.filter((_, j) => j !== i));
</script>

<div class="field">
	<div class="head">
		<span class="label">{label} <span class="opt">({value.length})</span></span>
		<button type="button" class="btn btn-sm" onclick={() => (open = true)}><ImagePlus size={16} /> Bilder hinzufügen</button>
	</div>
	{#if value.length}
		<ul class="grid">
			{#each value as m, i (m.id)}
				<li
					animate:flip={{ duration: 180 }}
					draggable="true"
					class:dragging={dragIndex === i}
					ondragstart={() => (dragIndex = i)}
					ondragover={(e) => {
						e.preventDefault();
						if (dragIndex !== null && dragIndex !== i) {
							move(dragIndex, i);
							dragIndex = i;
						}
					}}
					ondragend={() => (dragIndex = null)}
				>
					<img src={mediaSrc(m, 400)} alt={m.alt} />
					<div class="tools">
						<button type="button" onclick={() => move(i, i - 1)} disabled={i === 0} aria-label="Nach vorne"><ArrowLeft size={15} /></button>
						<button type="button" onclick={() => move(i, i + 1)} disabled={i === value.length - 1} aria-label="Nach hinten"><ArrowRight size={15} /></button>
						<button type="button" onclick={() => remove(i)} aria-label="Aus der Galerie entfernen" class="rm"><X size={15} /></button>
					</div>
					<input type="hidden" {name} value={m.id} />
				</li>
			{/each}
		</ul>
		<span class="hint">Reihenfolge per Ziehen oder mit den Pfeilen ändern. Entfernte Bilder bleiben in der Mediathek.</span>
	{:else}
		<button type="button" class="empty-drop" onclick={() => (open = true)}>
			<ImagePlus size={24} />
			Noch keine Bilder. Hier tippen, um Fotos hochzuladen oder aus der Mediathek zu wählen.
		</button>
	{/if}
</div>

<MediaLibrary bind:open multiple title="Bilder hinzufügen" onselect={add} />

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	li {
		position: relative;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		background: var(--c-surface-3);
		cursor: grab;
	}
	li.dragging {
		opacity: 0.4;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
	.tools {
		position: absolute;
		left: 0.3rem;
		right: 0.3rem;
		bottom: 0.3rem;
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}
	.tools button {
		display: grid;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 6px;
		background: rgb(16 24 33 / 0.72);
		color: #fff;
	}
	.tools button:disabled {
		opacity: 0.35;
	}
	.tools .rm {
		margin-left: auto;
	}
	.tools button:hover:not(:disabled) {
		background: rgb(16 24 33 / 0.92);
	}
	.empty-drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		border: 1px dashed var(--c-line-strong);
		border-radius: 10px;
		color: var(--c-ink-3);
		text-align: center;
	}
	.empty-drop:hover {
		border-color: var(--c-ink-3);
		color: var(--c-ink-2);
	}
</style>
