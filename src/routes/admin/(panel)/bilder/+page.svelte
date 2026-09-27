<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import X from '@lucide/svelte/icons/x';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import { formatBytes, formatNumber, formatStamp } from '$lib/format';
	import { mediaSrc } from '$lib/media';
	import { toasts } from '$lib/toast.svelte';
	import { uploadImage } from '$lib/upload';

	let { data } = $props();

	type Item = (typeof data.items)[number];
	let current = $state<Item | null>(null);
	let alt = $state('');
	let usage = $state<string[] | null>(null);
	let busy = $state(false);
	let uploading = $state<{ done: number; total: number } | null>(null);
	let dialog: HTMLDialogElement;
	let fileInput: HTMLInputElement;
	const docs = $derived(data.kind === 'dokument');
	const noun = $derived(docs ? 'Dokument' : 'Bild');

	async function openItem(m: Item) {
		current = m;
		alt = m.alt;
		usage = null;
		dialog.showModal();
		const res = await fetch(`/admin/api/medien/${m.id}`);
		if (res.ok) usage = (await res.json()).usage;
	}

	async function saveAlt() {
		if (!current) return;
		busy = true;
		const res = await fetch(`/admin/api/medien/${current.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ alt })
		});
		busy = false;
		if (res.ok) {
			toasts.show('Beschreibung gespeichert');
			dialog.close();
			await invalidateAll();
		} else toasts.show('Speichern fehlgeschlagen.', 'error');
	}

	async function remove() {
		if (!current || !confirm(`Dieses ${noun} endgültig löschen?`)) return;
		busy = true;
		const res = await fetch(`/admin/api/medien/${current.id}`, { method: 'DELETE' });
		busy = false;
		if (res.ok) {
			toasts.show(`${noun} gelöscht`);
			dialog.close();
			await invalidateAll();
		} else if (res.status === 409) {
			usage = (await res.json()).usage;
			toasts.show(`Das ${noun} wird noch verwendet und kann nicht gelöscht werden.`, 'error');
		} else toasts.show('Löschen fehlgeschlagen.', 'error');
	}

	async function upload(files: FileList | null) {
		if (!files?.length) return;
		const list = [...files];
		uploading = { done: 0, total: list.length };
		let failed = 0;
		for (const f of list) {
			try {
				await uploadImage(f);
			} catch (e) {
				failed++;
				toasts.show(`${f.name}: ${(e as Error).message}`, 'error');
			}
			uploading = { done: uploading.done + 1, total: list.length };
		}
		uploading = null;
		fileInput.value = '';
		const ok = list.length - failed;
		if (ok) toasts.show(`${ok} ${docs ? (ok === 1 ? 'Dokument' : 'Dokumente') : ok === 1 ? 'Bild' : 'Bilder'} hochgeladen`);
		await invalidateAll();
	}
</script>

<svelte:head><title>Bilder und Dokumente | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Bilder und Dokumente</h1>
		<p class="page-sub">
			Zusammen {formatBytes(data.bytes)}. Bilder werden beim Hochladen verkleinert und Standortdaten entfernt, Dokumente (PDF) bleiben unverändert.
		</p>
	</div>
	<button type="button" class="btn btn-primary" onclick={() => fileInput.click()} disabled={!!uploading}>
		<ImagePlus size={18} />
		{uploading ? `${uploading.done} von ${uploading.total} …` : docs ? 'PDF hochladen' : 'Bilder hochladen'}
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept={docs ? 'application/pdf,.pdf' : 'image/*,.heic,.heif'}
		multiple
		hidden
		onchange={(e) => upload(e.currentTarget.files)}
	/>
</div>

<nav class="tabs" aria-label="Art">
	<a href="?" aria-current={!docs ? 'page' : undefined}>Bilder <span class="n">{formatNumber(data.counts.bild)}</span></a>
	<a href="?art=dokument" aria-current={docs ? 'page' : undefined}>Dokumente <span class="n">{formatNumber(data.counts.dokument)}</span></a>
</nav>

{#if data.items.length && docs}
	<div class="card">
		<ul class="docs">
			{#each data.items as m (m.id)}
				<li>
					<button type="button" class="doc" onclick={() => openItem(m)}>
						<FileText size={20} />
						<span class="doc-name">{m.originalName || m.file}</span>
						<span class="muted small">{formatBytes(m.sizeBytes)}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
	<Pagination page={data.page} pages={data.pages} href={(p) => `?art=dokument${p > 1 ? `&seite=${p}` : ''}`} />
{:else if data.items.length}
	<ul class="grid">
		{#each data.items as m (m.id)}
			<li>
				<button type="button" class="tile" onclick={() => openItem(m)} title={m.originalName}>
					<img src={mediaSrc(m, 400)} alt={m.alt} loading="lazy" />
					{#if !m.alt}<span class="noalt">ohne Beschreibung</span>{/if}
				</button>
			</li>
		{/each}
	</ul>
	<Pagination page={data.page} pages={data.pages} href={(p) => (p > 1 ? `?seite=${p}` : '?')} />
{:else}
	<div class="card">
		<p class="empty">
			{docs ? 'Noch keine Dokumente. PDFs lassen sich hier oder im Texteditor hochladen.' : 'Noch keine Bilder. Bilder lassen sich hier oder direkt in Beiträgen hochladen.'}
		</p>
	</div>
{/if}

<dialog bind:this={dialog} class="detail" aria-label="Bild bearbeiten">
	{#if current}
		<div class="d-head">
			<h2 class="card-title">{current.originalName || noun}</h2>
			<button type="button" class="btn btn-ghost btn-icon" onclick={() => dialog.close()} aria-label="Schließen"><X size={20} /></button>
		</div>
		{#if current.kind === 'dokument'}
			<p class="muted small">PDF, {formatBytes(current.sizeBytes)}, hochgeladen {formatStamp(current.createdAt)}</p>
			<a href="/medien/{current.file}" target="_blank" rel="noopener" class="btn btn-sm open">Öffnen <ExternalLink size={14} /></a>
		{:else}
			<img src={mediaSrc(current, 800)} alt={current.alt} class="big" />
			<p class="muted small">{current.width} × {current.height} Pixel, hochgeladen {formatStamp(current.createdAt)}</p>
		{/if}
		<label class="field" hidden={current.kind === 'dokument'}>
			<span class="label">Bildbeschreibung</span>
			<input class="input" bind:value={alt} maxlength="300" placeholder="Was ist zu sehen? z. B. Tanklöschfahrzeug bei der Übung am Sportplatz" />
			<span class="hint">Wird blinden Menschen vorgelesen und erscheint unter Bildern in der Galerie.</span>
		</label>
		<div class="usage">
			<span class="label">Verwendet in</span>
			{#if usage === null}
				<p class="muted small">wird geprüft …</p>
			{:else if usage.length}
				<ul>{#each usage as u (u)}<li>{u}</li>{/each}</ul>
			{:else}
				<p class="muted small">Nirgends, es kann gelöscht werden.</p>
			{/if}
		</div>
		<div class="d-foot">
			<button type="button" class="btn btn-primary" onclick={saveAlt} disabled={busy} hidden={current.kind === 'dokument'}>Speichern</button>
			<button type="button" class="btn btn-danger" onclick={remove} disabled={busy || !!usage?.length}>Löschen</button>
		</div>
	{/if}
</dialog>

<style>
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--c-line);
	}
	.tabs a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.9rem;
		margin-bottom: -1px;
		border-bottom: 2px solid transparent;
		color: var(--c-ink-2);
		font-weight: 650;
		text-decoration: none;
	}
	.tabs a[aria-current='page'] {
		border-color: var(--c-accent);
		color: var(--c-ink);
	}
	.n {
		font-size: 0.8rem;
		color: var(--c-ink-3);
	}
	.docs li + li {
		border-top: 1px solid var(--c-line);
	}
	.doc {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		text-align: left;
		color: var(--c-ink);
	}
	.doc:hover {
		background: var(--c-surface-2);
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
	.open {
		align-self: flex-start;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.6rem;
	}
	.tile {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 10px;
		overflow: hidden;
		background: var(--c-surface-3);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.tile:hover img {
		opacity: 0.85;
	}
	.noalt {
		position: absolute;
		left: 0.35rem;
		bottom: 0.35rem;
		padding: 0.1rem 0.4rem;
		border-radius: 5px;
		background: rgb(16 24 33 / 0.72);
		color: #fff;
		font-size: 0.7rem;
		font-weight: 600;
	}
	.detail {
		width: min(34rem, calc(100vw - 1.5rem));
		margin: auto;
		padding: 1.25rem;
		border: 0;
		border-radius: 16px;
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-modal);
	}
	.detail[open] {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.detail::backdrop {
		background: var(--c-scrim);
	}
	.d-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.d-head h2 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.big {
		width: 100%;
		max-height: 18rem;
		object-fit: contain;
		border-radius: 10px;
		background: var(--c-surface-2);
	}
	.usage ul {
		margin-top: 0.3rem;
		font-size: 0.9rem;
		list-style: disc;
		padding-left: 1.2rem;
	}
	.d-foot {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
</style>
