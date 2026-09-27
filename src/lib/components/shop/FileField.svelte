<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import { getI18n } from '$lib/i18n.svelte';
	import type { UploadedFile } from '$lib/shop-types';


	interface Props {
		/** Formularfeld mit den Datei-IDs (kommagetrennt) */
		name: string;
		label: string;
		help?: string;
		required?: boolean;
		max?: number;
		/** Ziel des Uploads */
		endpoint?: string;
		invalid?: boolean;
		files?: UploadedFile[];
		accept?: string;
	}

	let { name, label, help = '', required = false, max = 1, endpoint = '/api/datei', invalid = false, files = $bindable([]), accept = '.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.avif,.pdf,.ai,.eps,.svg,.zip' }: Props = $props();
	const i = getI18n();
	let busy = $state(0);
	let progress = $state(0);
	let message = $state('');
	let input = $state<HTMLInputElement>();
	const ids = $props.id();

	function upload(file: File): Promise<UploadedFile> {
		const body = new FormData();
		body.append('datei', file, file.name);
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', endpoint);
			xhr.setRequestHeader('Accept-Language', i.locale);
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
				else reject(new Error(data.message || i.tr('Hochladen fehlgeschlagen.', 'Upload failed.')));
			};
			xhr.onerror = () => reject(new Error(i.tr('Keine Verbindung zum Server.', 'No connection to the server.')));
			xhr.send(body);
		});
	}

	async function pick(list: FileList | null) {
		if (!list?.length) return;
		message = '';
		const room = Math.max(0, max - files.length);
		const chosen = [...list].slice(0, room);
		if (list.length > room) message = i.tr(`Höchstens ${max} Dateien.`, `At most ${max} files.`);
		for (const f of chosen) {
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

	const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
</script>

<div class="field">
	<span class="label" id="{ids}-l">{label}{#if required}<span class="req"> *</span>{/if}</span>
	{#if help}<span class="hint">{help}</span>{/if}
	<input type="hidden" {name} value={files.map((f) => f.id).join(',')} />

	{#if files.length}
		<ul class="list">
			{#each files as f (f.id)}
				<li>
					{#if f.preview}
						<img src="/datei/{f.key}?vorschau=1" alt="" width="64" height="64" />
					{:else}
						<span class="doc"><FileText size={22} /></span>
					{/if}
					<span class="meta"><span class="n">{f.name}</span><span class="hint">{size(f.size)}</span></span>
					<button type="button" class="icon-btn" aria-label={i.tr(`${f.name} entfernen`, `Remove ${f.name}`)} onclick={() => (files = files.filter((x) => x.id !== f.id))}><X size={18} /></button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if files.length < max}
		<label class="drop" class:invalid aria-describedby="{ids}-l">
			<input bind:this={input} type="file" {accept} multiple={max > 1} onchange={(e) => pick(e.currentTarget.files)} disabled={busy > 0} />
			<Upload size={20} />
			<span>
				{#if busy}
					{i.tr('Wird hochgeladen …', 'Uploading …')} {Math.round(progress * 100)} %
				{:else}
					{max > 1 ? i.tr('Dateien auswählen', 'Choose files') : i.tr('Datei auswählen', 'Choose file')}
				{/if}
			</span>
			<span class="hint">{i.tr('Fotos, PDF oder Vektordatei (AI, EPS, SVG) · max. 25 MB', 'Photos, PDF or vector file (AI, EPS, SVG) · max. 25 MB')}</span>
		</label>
	{/if}
	{#if message}<p class="error-text" role="alert">{message}</p>{/if}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: #18181b;
	}
	.list img,
	.doc {
		width: 3.5rem;
		height: 3.5rem;
		object-fit: cover;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: #27272a;
		color: #a1a1aa;
	}
	.meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.n {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
	}
	.drop {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1.25rem 1rem;
		border: 1.5px dashed #52525b;
		text-align: center;
		cursor: pointer;
		font-weight: 650;
	}
	.drop:hover,
	.drop:focus-within {
		border-color: #fff;
	}
	.drop.invalid {
		border-color: var(--s-danger);
	}
	.drop input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
</style>
