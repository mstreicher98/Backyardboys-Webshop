<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import { submitting } from '$lib/formEnhance';

	let { data, form } = $props();
	type Model = (typeof data.models)[number];
	let editBrand = $state<{ id?: number; name?: string; active?: boolean; sortOrder?: number } | null>(null);
	let editModel = $state<Partial<Model> | null>(null);
	let showImport = $state(false);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	const current = $derived(data.brands.find((b) => b.id === data.brandId));
</script>

<svelte:head><title>Bike-Datenbank | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Bike-Datenbank</h1>
		<p class="page-sub">Marken und Modelle für den Bike-Finder und die Bike-Auswahl beim Bestellen. Baujahre je Modellgeneration anlegen, wenn sich die Kunststoffteile ändern.</p>
	</div>
	<button type="button" class="btn" onclick={() => (editBrand = {})}><Plus size={16} /> Marke</button>
</div>

<div class="layout">
	<nav class="card brands" aria-label="Marken">
		{#each data.brands as b (b.id)}
			<a href="?marke={b.id}" aria-current={b.id === data.brandId ? 'page' : undefined}>
				<span>{b.name}{#if !b.active} <span class="muted small">(aus)</span>{/if}</span>
				<span class="muted small">{b.models}</span>
			</a>
		{/each}
	</nav>

	<section class="card card-pad">
		{#if current}
			<div class="head">
				<h2 class="card-title">{current.name}</h2>
				<div class="row">
					<button type="button" class="btn btn-sm btn-ghost" onclick={() => (editBrand = { ...current })}>Marke bearbeiten</button>
					<button type="button" class="btn btn-sm btn-ghost" onclick={() => (showImport = !showImport)}>Liste einfügen</button>
					<button type="button" class="btn btn-sm" onclick={() => (editModel = { brandId: current.id, active: true })}><Plus size={15} /> Modell</button>
				</div>
			</div>

			{#if showImport}
				<form method="POST" action="?/import" class="stack import" use:enhance={submitting(setBusy)}>
					<input type="hidden" name="marke" value={current.id} />
					<label class="field">
						<span class="label">Ein Modell je Zeile: Name; Bauart; Baujahr von; Baujahr bis (leer = aktuell)</span>
						<textarea class="textarea" name="liste" rows="6" placeholder={'EXC 300; Enduro; 2017; 2023\nEXC 300; Enduro; 2024;\nSX 125; MX; 2023;'}></textarea>
					</label>
					<div><button class="btn btn-primary btn-sm" disabled={busy}>Anlegen</button></div>
					{#if form?.importErrors?.length}<p class="alert alert-warn">Nicht verstanden: {form.importErrors.join(' · ')}</p>{/if}
				</form>
			{/if}

			{#if data.models.length}
				<table class="table">
					<thead><tr><th>Modell</th><th>Bauart</th><th>Baujahre</th><th class="num">Dekore</th><th></th></tr></thead>
					<tbody>
						{#each data.models as m (m.id)}
							<tr>
								<td><button type="button" class="linkish" onclick={() => (editModel = { ...m })}><strong>{m.name}</strong></button></td>
								<td class="muted">{m.category}</td>
								<td class="tabular">{m.yearFrom}–{m.yearTo ?? 'heute'}</td>
								<td class="num">{m.products}</td>
								<td>{#if !m.active}<span class="badge">aus</span>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="empty">Noch keine Modelle für {current.name}.</p>
			{/if}
		{:else}
			<p class="empty">Leg zuerst eine Marke an.</p>
		{/if}
	</section>
</div>

{#if editBrand}
	<div class="modal-bg" onclick={() => (editBrand = null)} aria-hidden="true"></div>
	<form method="POST" action="?/marke" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editBrand = null) })}>
		<h2 class="card-title">{editBrand.id ? 'Marke bearbeiten' : 'Neue Marke'}</h2>
		<input type="hidden" name="id" value={editBrand.id ?? ''} />
		<label class="field"><span class="label">Name</span><input class="input" name="name" required value={editBrand.name ?? ''} /></label>
		<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={editBrand.sortOrder ?? 0} /></label>
		{#if editBrand.id}<label class="check"><input type="checkbox" name="aktiv" checked={editBrand.active} /><span>Im Bike-Finder zeigen</span></label>{/if}
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editBrand = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if editBrand.id}<button class="btn btn-danger" formaction="?/marke_loeschen" formnovalidate onclick={(e) => !confirm('Marke samt Modellen löschen?') && e.preventDefault()}>Löschen</button>{/if}
		</div>
	</form>
{/if}

{#if editModel}
	<div class="modal-bg" onclick={() => (editModel = null)} aria-hidden="true"></div>
	<form method="POST" action="?/modell" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editModel = null) })}>
		<h2 class="card-title">{editModel.id ? 'Modell bearbeiten' : 'Neues Modell'}</h2>
		<input type="hidden" name="id" value={editModel.id ?? ''} />
		<input type="hidden" name="marke" value={editModel.brandId} />
		<div class="grid-2">
			<label class="field"><span class="label">Modell</span><input class="input" name="name" required value={editModel.name ?? ''} placeholder="z. B. EXC 300" /></label>
			<label class="field"><span class="label">Bauart</span><input class="input" name="bauart" value={editModel.category ?? ''} placeholder="MX, Enduro, Supermoto …" list="bauarten" /></label>
		</div>
		<datalist id="bauarten"><option value="MX"></option><option value="Enduro"></option><option value="Supermoto"></option><option value="Trial"></option><option value="Pitbike"></option><option value="E-Bike"></option></datalist>
		<div class="grid-2">
			<label class="field"><span class="label">Baujahr von</span><input class="input" type="number" name="von" required value={editModel.yearFrom ?? ''} /></label>
			<label class="field"><span class="label">Baujahr bis <span class="opt">(leer = aktuell)</span></span><input class="input" type="number" name="bis" value={editModel.yearTo ?? ''} /></label>
		</div>
		{#if editModel.id}<label class="check"><input type="checkbox" name="aktiv" checked={editModel.active} /><span>Aktiv</span></label>{/if}
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editModel = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if editModel.id}<button class="btn btn-danger" formaction="?/modell_loeschen" formnovalidate onclick={(e) => !confirm('Modell löschen?') && e.preventDefault()}>Löschen</button>{/if}
		</div>
	</form>
{/if}

<style>
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: 15rem 1fr;
			align-items: start;
		}
	}
	.brands {
		display: flex;
		flex-direction: column;
		padding: 0.4rem;
	}
	.brands a {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0.7rem;
		border-radius: 8px;
		color: var(--c-ink);
		text-decoration: none;
		font-weight: 600;
	}
	.brands a:hover {
		background: var(--c-surface-2);
	}
	.brands a[aria-current='page'] {
		background: var(--c-accent);
		color: var(--c-bg);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.import {
		margin-bottom: 1.25rem;
		padding: 1rem;
		border-radius: 10px;
		background: var(--c-surface-2);
	}
	.num {
		text-align: right;
	}
	.linkish {
		color: var(--c-ink);
		text-align: left;
	}
	.linkish:hover {
		text-decoration: underline;
	}
</style>
