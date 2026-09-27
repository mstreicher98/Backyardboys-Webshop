<script lang="ts">
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import { mediaSrc, type MediaRef } from '$lib/media';
	import MediaLibrary from './MediaLibrary.svelte';

	interface Props {
		name: string;
		label: string;
		value: MediaRef | null;
		hint?: string;
		/** Form des Vorschaubilds */
		aspect?: string;
	}

	let { name, label, value = $bindable(), hint = '', aspect = '3 / 2' }: Props = $props();
	let open = $state(false);
</script>

<div class="field">
	<span class="label">{label}</span>
	<div class="img-field">
		<button type="button" class="preview" style:aspect-ratio={aspect} onclick={() => (open = true)}>
			{#if value}
				<img src={mediaSrc(value, 800)} alt={value.alt} />
			{:else}
				<span class="ph"><ImagePlus size={26} /> Bild wählen</span>
			{/if}
		</button>
		<div class="btns">
			<button type="button" class="btn btn-sm" onclick={() => (open = true)}>{value ? 'Anderes Bild' : 'Bild wählen'}</button>
			{#if value}<button type="button" class="btn btn-sm btn-ghost" onclick={() => (value = null)}>Entfernen</button>{/if}
		</div>
	</div>
	{#if hint}<span class="hint">{hint}</span>{/if}
	<input type="hidden" {name} value={value?.id ?? ''} />
</div>

<MediaLibrary bind:open title={label} onselect={(items) => (value = items[0] ?? null)} />

<style>
	.img-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.preview {
		display: block;
		width: 100%;
		max-width: 22rem;
		border-radius: 10px;
		overflow: hidden;
		background: var(--c-surface-2);
		border: 1px dashed var(--c-line-strong);
	}
	.preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ph {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		height: 100%;
		color: var(--c-ink-3);
		font-weight: 600;
	}
	.preview:hover {
		border-color: var(--c-ink-3);
	}
	.btns {
		display: flex;
		gap: 0.4rem;
	}
</style>
