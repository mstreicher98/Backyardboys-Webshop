<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Upload from '@lucide/svelte/icons/upload';
	import { formatBackupName, formatBytes, formatDay } from '$lib/format';
	import { submitting } from '$lib/formEnhance';
	import type { BackupSummary } from '$lib/types';

	interface Candidate {
		/** "stand:<Name>" oder "upload:<id>" – so erwartet es die Aktion ?/wiederherstellen */
		quelle: string;
		title: string;
		summary: BackupSummary;
	}

	let candidate = $state<Candidate | null>(null);
	let progress = $state<{ name: string; sent: number; total: number } | null>(null);
	let checking = $state(false);
	let restoring = $state(false);
	let confirmed = $state(false);
	let problem = $state('');
	let input: HTMLInputElement;
	let panel = $state<HTMLElement>();
	let abort: AbortController | null = null;

	const n = (v: number) => v.toLocaleString('de-AT');
	const s = $derived(candidate?.summary);

	async function api(url: string, init: RequestInit = {}) {
		const r = await fetch(url, { ...init, headers: { accept: 'application/json', ...init.headers } });
		const body = r.status === 204 ? null : await r.json().catch(() => null);
		if (!r.ok) throw new Error(body?.message ?? `Fehler ${r.status}`);
		return body;
	}

	async function show(c: Candidate) {
		candidate = c;
		confirmed = false;
		await tick();
		panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	/** Laufenden Upload stoppen und hochgeladene Datei verwerfen */
	async function cancel() {
		abort?.abort();
		const quelle = candidate?.quelle;
		candidate = null;
		problem = '';
		if (quelle?.startsWith('upload:')) await api(`/admin/api/sicherung/${quelle.slice(7)}`, { method: 'DELETE' }).catch(() => {});
	}

	/** Stand aus der Liste am Server */
	export async function checkStand(name: string) {
		await cancel();
		checking = true;
		try {
			const summary = await api(`/admin/api/sicherung?stand=${encodeURIComponent(name)}`);
			await show({ quelle: `stand:${name}`, title: `Sicherung vom ${formatBackupName(name)}`, summary });
		} catch (e) {
			problem = (e as Error).message;
		} finally {
			checking = false;
		}
	}

	/** Heruntergeladene .tar-Datei in Stücken hochladen, dann prüfen lassen */
	async function upload() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await cancel();
		const ctrl = new AbortController();
		abort = ctrl;
		let id: string | null = null;
		try {
			const start = await api('/admin/api/sicherung', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ groesse: file.size, name: file.name }),
				signal: ctrl.signal
			});
			id = start.id as string;
			const step = start.stueck as number;
			let offset = 0;
			let tries = 0;
			progress = { name: file.name, sent: 0, total: file.size };
			while (offset < file.size) {
				try {
					const r = await api(`/admin/api/sicherung/${id}?offset=${offset}`, {
						method: 'PUT',
						headers: { 'content-type': 'application/octet-stream' },
						body: file.slice(offset, offset + step),
						signal: ctrl.signal
					});
					offset = r.received;
					tries = 0;
				} catch (e) {
					// kurz keine Verbindung: dasselbe Stück noch einmal – der Server meldet, was schon da ist
					if (ctrl.signal.aborted || ++tries > 4) throw e;
					await new Promise((res) => setTimeout(res, 1500 * tries));
				}
				progress = { name: file.name, sent: offset, total: file.size };
			}
			progress = null;
			checking = true;
			const summary = await api(`/admin/api/sicherung/${id}`, { method: 'POST', signal: ctrl.signal });
			await show({ quelle: `upload:${id}`, title: file.name, summary });
		} catch (e) {
			if (!ctrl.signal.aborted) problem = (e as Error).message;
			if (id) void api(`/admin/api/sicherung/${id}`, { method: 'DELETE' }).catch(() => {});
		} finally {
			progress = null;
			checking = false;
			if (abort === ctrl) abort = null;
		}
	}

	const leaving = 'Der Upload läuft noch. Seite trotzdem verlassen?';
	beforeNavigate(({ cancel: stay, type }) => {
		if (!progress || type === 'leave') return;
		if (!confirm(leaving)) stay();
		else abort?.abort();
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (progress || restoring) e.preventDefault();
	}}
/>

<div class="restore">
	<div class="r-head">
		<div>
			<h3 class="r-title">Sicherung wiederherstellen</h3>
			<p class="hint">Einen Stand aus der Liste wählen oder eine heruntergeladene Sicherung (.tar) hochladen. Vor dem Wiederherstellen wird der aktuelle Stand automatisch gesichert.</p>
		</div>
		<label class="btn" class:disabled={!!progress || checking || restoring}>
			<Upload size={16} /> Datei hochladen
			<input bind:this={input} type="file" accept=".tar,application/x-tar" class="file" onchange={upload} disabled={!!progress || checking || restoring} />
		</label>
	</div>

	{#if progress}
		<div class="progress" role="status">
			<progress max={progress.total} value={progress.sent}></progress>
			<p class="small">
				{progress.name}: {formatBytes(progress.sent)} von {formatBytes(progress.total)}
				<button type="button" class="btn btn-sm btn-ghost" onclick={cancel}>Abbrechen</button>
			</p>
		</div>
	{/if}
	{#if checking}<p class="small muted" role="status">Sicherung wird geprüft …</p>{/if}
	{#if problem}<p class="alert alert-error" role="alert">{problem}</p>{/if}

	{#if candidate && s}
		<div class="candidate" bind:this={panel}>
			<h4 class="c-title">{candidate.title}</h4>
			<dl class="facts">
				<div><dt>Produkte</dt><dd>{n(s.products)}</dd></div>
				<div><dt>Bestellungen</dt><dd>{n(s.orders)}</dd></div>
				<div><dt>Kunden</dt><dd>{n(s.customers)}</dd></div>
				<div><dt>Rechnungen</dt><dd>{n(s.invoices)}</dd></div>
				<div><dt>Bilder &amp; PDFs</dt><dd>{n(s.media)}</dd></div>
			</dl>
			<p class="small muted">
				{#if s.lastOrder}Neueste Bestellung vom {formatDay(s.lastOrder)}. {/if}Zugänge: {s.users.join(', ') || 'keine'}.
			</p>
			{#if s.older}
				<p class="alert alert-info">Die Sicherung stammt von einer älteren Version der Webseite und wird beim Wiederherstellen angepasst.</p>
			{/if}
			<p class="alert alert-warn">
				<TriangleAlert size={18} />
				<span>
					Der gesamte aktuelle Stand wird ersetzt: Produkte, Bestellungen, Rechnungen, Kunden, Seiten, Bilder, Einstellungen und Zugänge. Danach sind alle abgemeldet
					und melden sich mit den Passwörtern aus der Sicherung an.
				</span>
			</p>
			<form method="POST" action="?/wiederherstellen" use:enhance={submitting((b) => (restoring = b))}>
				<input type="hidden" name="quelle" value={candidate.quelle} />
				<label class="check">
					<input type="checkbox" name="bestaetigt" value="ja" bind:checked={confirmed} disabled={restoring} />
					<span>Ich möchte den aktuellen Stand durch diese Sicherung ersetzen.</span>
				</label>
				<div class="c-actions">
					<button class="btn btn-danger" disabled={!confirmed || restoring}>{restoring ? 'Wird wiederhergestellt …' : 'Sicherung wiederherstellen'}</button>
					<button type="button" class="btn btn-ghost" onclick={cancel} disabled={restoring}>Abbrechen</button>
				</div>
				{#if restoring}<p class="small muted" role="status">Bei vielen Bildern dauert das einige Minuten. Bitte die Seite offen lassen.</p>{/if}
			</form>
		</div>
	{/if}
</div>

<style>
	.restore {
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--c-line);
	}
	.r-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}
	.r-title {
		font-weight: 700;
	}
	.r-head > div {
		flex: 1 1 20rem;
	}
	.r-head .hint {
		max-width: 60ch;
	}
	label.btn {
		position: relative;
		cursor: pointer;
	}
	/* Dateiauswahl unsichtbar, aber per Tastatur erreichbar */
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}
	label.btn:focus-within {
		outline: 2px solid var(--c-focus, currentColor);
		outline-offset: 2px;
	}
	label.btn.disabled {
		opacity: 0.55;
		pointer-events: none;
	}
	.progress {
		margin-top: 1rem;
	}
	progress {
		width: 100%;
		height: 0.6rem;
		accent-color: var(--c-accent);
	}
	.progress .small {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}
	.alert,
	.muted[role='status'] {
		margin-top: 1rem;
	}
	.candidate {
		margin-top: 1rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--c-line-strong);
		border-radius: 10px;
		display: grid;
		gap: 0.75rem;
	}
	.candidate .alert {
		margin-top: 0;
	}
	.c-title {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.75rem;
	}
	.facts dt {
		font-size: 0.8rem;
		color: var(--c-ink-3);
	}
	.facts dd {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.c-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
</style>
