<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import type { UploadedFile } from '$lib/shop-types';

	/** Dateien hochladen (Entwürfe, Anhänge) – privat, wie Kunden-Uploads */
	interface Props {
		name: string;
		label: string;
		hint?: string;
		max?: number;
		files?: UploadedFile[];
	}

	let { name, label, hint = '', max = 10, files = $bindable([]) }: Props = $props();
	let busy = $state(0);
	let progress = $state(0);
	let message = $state('');
	let input = $state<HTMLInputElement>();

	function upload(file: File): Promise<UploadedFile> {
		const body = new FormData();
		body.append('datei', file, file.name);
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', '/admin/api/datei');
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) progress = e.loaded / e.total;
			};
			xhr.onload = () => {
				let data: { message?: string } & Partial<UploadedFile> = {};
				try {
					data = JSON.parse(xhr.responseText);
				} catch {
					/* keine JSON-Antwort */
				}
				if (xhr.status >= 200 && xhr.status < 300) resolve(data as UploadedFile);
				else reject(new Error(data.message || 'Hochladen fehlgeschlagen.'));
			};
			xhr.onerror = () => reject(new Error('Keine Verbindung zum Server.'));
			xhr.send(body);
		});
	}

	async function pick(list: FileList | null) {
		if (!list?.length) return;
		message = '';
		for (const f of [...list].slice(0, Math.max(0, max - files.length))) {
			busy++;
			progress = 0;
			try {
				files = [...files, await upload(f)];
			} catch (err) {
				message = (err as Error).message;
			} finally {
				busy--;
			}
		}
		if (input) input.value = '';
	}
</script>

<div class="field">
	<span class="label">{label}</span>
	{#if hint}<span class="hint">{hint}</span>{/if}
	<input type="hidden" {name} value={files.map((f) => f.id).join(',')} />
	{#if files.length}
		<ul class="list">
			{#each files as f (f.id)}
				<li>
					{#if f.preview}<img src="/datei/{f.key}?vorschau=1" alt="" />{:else}<span class="doc"><FileText size={20} /></span>{/if}
					<span class="n">{f.name}</span>
					<button type="button" class="btn btn-ghost btn-sm btn-icon" aria-label="{f.name} entfernen" onclick={() => (files = files.filter((x) => x.id !== f.id))}><X size={16} /></button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if files.length < max}
		<label class="drop">
			<input bind:this={input} type="file" multiple={max > 1} onchange={(e) => pick(e.currentTarget.files)} disabled={busy > 0} />
			<Upload size={18} />
			{busy ? `Wird hochgeladen … ${Math.round(progress * 100)} %` : 'Dateien auswählen'}
		</label>
	{/if}
	{#if message}<p class="alert alert-error">{message}</p>{/if}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem;
		border: 1px solid var(--c-line);
		border-radius: 8px;
	}
	.list img,
	.doc {
		width: 2.75rem;
		height: 2.75rem;
		object-fit: cover;
		border-radius: 5px;
		display: grid;
		place-items: center;
		background: var(--c-surface-3);
		flex-shrink: 0;
	}
	.n {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
	}
	.drop {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.9rem;
		border: 1.5px dashed var(--c-line-strong);
		border-radius: 9px;
		color: var(--c-ink-2);
		font-weight: 600;
		cursor: pointer;
	}
	.drop:hover {
		border-color: var(--c-ink-3);
	}
	.drop input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
</style>
