<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import FileText from '@lucide/svelte/icons/file-text';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { formatBytes } from '$lib/format';
	import { mediaSrc, type MediaRef } from '$lib/media';
	import { toasts } from '$lib/toast.svelte';
	import { uploadImage } from '$lib/upload';

	type Item = MediaRef & { originalName?: string; sizeBytes?: number };

	interface Props {
		open: boolean;
		multiple?: boolean;
		title?: string;
		/** bild = Bilder (Standard), dokument = PDFs */
		kind?: 'bild' | 'dokument';
		onselect: (items: Item[]) => void;
	}

	let { open = $bindable(), multiple = false, title = 'Bild auswählen', kind = 'bild', onselect }: Props = $props();
	const docs = $derived(kind === 'dokument');

	let dialog: HTMLDialogElement;
	let items = $state<Item[]>([]);
	let page = $state(1);
	let pages = $state(1);
	let query = $state('');
	let loading = $state(false);
	let selected = $state<Item[]>([]);
	let uploads = $state<{ id: number; name: string; progress: number; error?: string }[]>([]);
	let dragOver = $state(false);
	let fileInput: HTMLInputElement;
	let uploadSeq = 0;

	async function load(reset = true) {
		loading = true;
		try {
			const p = reset ? 1 : page + 1;
			const res = await fetch(`/admin/api/medien?art=${kind}&seite=${p}&suche=${encodeURIComponent(query)}`);
			const data = await res.json();
			items = reset ? data.items : [...items, ...data.items];
			page = data.page;
			pages = data.pages;
		} catch {
			toasts.show('Die Bilder konnten nicht geladen werden.', 'error');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open && dialog && !dialog.open) {
			selected = [];
			uploads = [];
			dialog.showModal();
			void load();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => load(), 250);
	}

	const isSelected = (m: Item) => selected.some((s) => s.id === m.id);

	function toggle(m: Item) {
		if (!multiple) {
			onselect([m]);
			open = false;
			return;
		}
		selected = isSelected(m) ? selected.filter((s) => s.id !== m.id) : [...selected, m];
	}

	function confirm() {
		if (selected.length) onselect(selected);
		open = false;
	}

	async function handleFiles(files: FileList | File[]) {
		const list = [...files].filter((f) =>
			docs ? f.type === 'application/pdf' || /\.pdf$/i.test(f.name) : f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
		);
		if (!list.length) return;
		// Nacheinander hochladen – schont schwache Handyverbindungen
		for (const f of list) {
			const entry = { id: ++uploadSeq, name: f.name, progress: 0 };
			uploads.push(entry);
			const idx = uploads.length - 1;
			try {
				const m = await uploadImage(f, (p) => (uploads[idx].progress = p));
				uploads[idx].progress = 1;
				items = [m, ...items];
				if (multiple) selected = [...selected, m];
				else {
					onselect([m]);
					open = false;
					return;
				}
			} catch (err) {
				uploads[idx].error = (err as Error).message;
			}
		}
		uploads = uploads.filter((u) => u.error);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files.length) void handleFiles(e.dataTransfer.files);
	}
</script>

<dialog bind:this={dialog} class="lib" onclose={() => (open = false)} aria-labelledby="lib-title">
	<div class="head">
		<h2 id="lib-title">{title}</h2>
		<button type="button" class="btn btn-ghost btn-icon" onclick={() => (open = false)} aria-label="Schließen"><X size={20} /></button>
	</div>

	<div
		class="drop"
		class:over={dragOver}
		role="region"
		aria-label="Bilder hochladen"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
	>
		<button type="button" class="btn btn-primary" onclick={() => fileInput.click()}>
			<ImagePlus size={18} />
			{docs ? 'PDF hochladen' : multiple ? 'Bilder hochladen' : 'Bild hochladen'}
		</button>
		<span class="muted small">{docs ? 'oder hierher ziehen. Nur PDF, höchstens 25 MB.' : 'oder hierher ziehen. Handyfotos werden automatisch verkleinert.'}</span>
		<input
			bind:this={fileInput}
			type="file"
			accept={docs ? 'application/pdf,.pdf' : 'image/*,.heic,.heif'}
			{multiple}
			hidden
			onchange={(e) => handleFiles(e.currentTarget.files ?? [])}
		/>
	</div>

	{#if uploads.length}
		<ul class="uploads">
			{#each uploads as u (u.id)}
				<li class:err={!!u.error}>
					<span class="u-name">{u.name}</span>
					{#if u.error}
						<span>{u.error}</span>
					{:else}
						<span class="bar"><span style:width="{Math.round(u.progress * 100)}%"></span></span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<label class="search">
		<Search size={17} />
		<input class="input" type="search" placeholder="Nach Dateiname oder Beschreibung suchen" bind:value={query} oninput={onSearch} />
	</label>

	<div class="grid-wrap">
		{#if items.length && docs}
			<ul class="doclist">
				{#each items as m (m.id)}
					<li>
						<button type="button" class="doc" class:sel={isSelected(m)} onclick={() => toggle(m)}>
							<FileText size={20} />
							<span class="doc-name">{m.originalName || m.file}</span>
							{#if m.sizeBytes}<span class="muted small">{formatBytes(m.sizeBytes)}</span>{/if}
						</button>
					</li>
				{/each}
			</ul>
			{#if page < pages}
				<div class="more"><button type="button" class="btn btn-sm" onclick={() => load(false)} disabled={loading}>Weitere laden</button></div>
			{/if}
		{:else if items.length}
			<ul class="grid">
				{#each items as m (m.id)}
					<li>
						<button type="button" class="tile" class:sel={isSelected(m)} onclick={() => toggle(m)} aria-pressed={multiple ? isSelected(m) : undefined}>
							<img src={mediaSrc(m, 400)} alt={m.alt} loading="lazy" />
							{#if isSelected(m)}<span class="mark"><Check size={16} strokeWidth={3} /></span>{/if}
						</button>
					</li>
				{/each}
			</ul>
			{#if page < pages}
				<div class="more"><button type="button" class="btn btn-sm" onclick={() => load(false)} disabled={loading}>Weitere Bilder laden</button></div>
			{/if}
		{:else if !loading}
			<p class="empty">
				{query ? 'Nichts gefunden.' : docs ? 'Noch keine Dokumente. Lade oben das erste PDF hoch.' : 'Noch keine Bilder in der Mediathek. Lade oben das erste hoch.'}
			</p>
		{/if}
	</div>

	{#if multiple}
		<div class="foot">
			<span class="muted small">{selected.length} ausgewählt</span>
			<button type="button" class="btn" onclick={() => (open = false)}>Abbrechen</button>
			<button type="button" class="btn btn-primary" onclick={confirm} disabled={!selected.length}>Übernehmen</button>
		</div>
	{/if}
</dialog>

<style>
	.lib {
		width: min(60rem, 100vw);
		height: min(46rem, 100dvh);
		max-width: 100vw;
		max-height: 100dvh;
		margin: auto;
		padding: 0;
		border: 0;
		border-radius: 16px;
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-modal);
		flex-direction: column;
	}
	.lib[open] {
		display: flex;
	}
	@media (max-width: 640px) {
		.lib {
			border-radius: 0;
			height: 100dvh;
		}
	}
	.lib::backdrop {
		background: var(--c-scrim);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem 1rem 0.5rem 1.25rem;
	}
	h2 {
		font-size: 1.2rem;
		font-weight: 750;
		font-stretch: 85%;
	}
	.drop {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 0 1.25rem;
		padding: 0.9rem;
		border: 2px dashed var(--c-line-strong);
		border-radius: 12px;
	}
	.drop.over {
		border-color: var(--c-accent);
		background: var(--c-accent-soft);
	}
	.uploads {
		margin: 0.75rem 1.25rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
	}
	.uploads li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 40%;
		gap: 0.75rem;
		align-items: center;
	}
	.uploads .err {
		color: var(--c-danger);
	}
	.u-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		height: 6px;
		border-radius: 3px;
		background: var(--c-surface-3);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--c-accent);
		transition: width 150ms;
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		margin: 0.9rem 1.25rem 0.5rem;
	}
	.search :global(svg) {
		position: absolute;
		left: 0.75rem;
		color: var(--c-ink-3);
	}
	.search .input {
		padding-left: 2.3rem;
	}
	.grid-wrap {
		flex: 1;
		overflow-y: auto;
		padding: 0.25rem 1.25rem 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
		gap: 0.5rem;
	}
	.tile {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		background: var(--c-surface-3);
		outline-offset: 2px;
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tile:hover img {
		opacity: 0.85;
	}
	.tile.sel {
		outline: 3px solid var(--c-accent);
	}
	.mark {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		background: var(--c-accent);
		color: #fff;
	}
	.doclist {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.doc {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		text-align: left;
		color: var(--c-ink);
	}
	.doc:hover {
		background: var(--c-surface-2);
	}
	.doc.sel {
		background: var(--c-accent-soft);
		outline: 2px solid var(--c-accent);
	}
	.doc :global(svg) {
		flex-shrink: 0;
		color: var(--c-accent);
	}
	.doc-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.more {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--c-line);
	}
	.foot .muted {
		margin-right: auto;
	}
</style>
