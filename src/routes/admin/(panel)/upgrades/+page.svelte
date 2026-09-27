<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import ImageField from '$lib/components/admin/ImageField.svelte';
	import { euro, euroInput } from '$lib/admin-labels';
	import { submitting } from '$lib/formEnhance';
	import { mediaSrc } from '$lib/media';

	let { data } = $props();
	type Opt = (typeof data.groups)[number]['options'][number];
	let editing = $state<(Partial<Opt> & { groupId: number }) | null>(null);
	let editingGroup = $state<{ id?: number; name?: string; nameEn?: string; sortOrder?: number } | null>(null);
	let image = $state<Opt['image']>(null);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
</script>

<svelte:head><title>Base & Finish | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Base & Finish</h1>
		<p class="page-sub">Upgrades für Dekore mit Aufpreis. Welche Gruppen ein Dekor anbietet, stellst du beim Produkt ein.</p>
	</div>
	<button type="button" class="btn" onclick={() => (editingGroup = {})}><Plus size={16} /> Neue Gruppe</button>
</div>

{#each data.groups as g (g.id)}
	<section class="card card-pad group">
		<div class="g-head">
			<h2 class="card-title">{g.name}{#if g.nameEn}<span class="muted small"> · {g.nameEn}</span>{/if}</h2>
			<div class="row">
				<button type="button" class="btn btn-sm btn-ghost" onclick={() => (editingGroup = { ...g })}>Umbenennen</button>
				<button type="button" class="btn btn-sm" onclick={() => ((editing = { groupId: g.id, active: true, surcharge: 0 }), (image = null))}><Plus size={15} /> Option</button>
			</div>
		</div>
		<ul class="opts">
			{#each g.options as o (o.id)}
				<li>
					<button type="button" class="opt" onclick={() => ((editing = { ...o }), (image = o.image))}>
						<span class="sw">{#if o.image}<img src={mediaSrc(o.image, 400)} alt="" />{/if}</span>
						<strong>{o.name}</strong>
						<span class="tabular">{o.surcharge ? `+ ${euro(o.surcharge)}` : 'ohne Aufpreis'}</span>
						{#if o.isDefault}<span class="badge badge-info">Standard</span>{/if}
						{#if !o.active}<span class="badge">inaktiv</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/each}

{#if editing}
	<div class="modal-bg" onclick={() => (editing = null)} aria-hidden="true"></div>
	<form method="POST" action="?/option" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editing = null) })}>
		<h2 class="card-title">{editing.id ? 'Option bearbeiten' : 'Neue Option'}</h2>
		<input type="hidden" name="id" value={editing.id ?? ''} />
		<input type="hidden" name="gruppe" value={editing.groupId} />
		<div class="grid-2">
			<label class="field"><span class="label">Name</span><input class="input" name="name" required value={editing.name ?? ''} /></label>
			<label class="field"><span class="label">Englisch</span><input class="input" name="name_en" value={editing.nameEn ?? ''} /></label>
		</div>
		<div class="grid-2">
			<label class="field"><span class="label">Aufpreis € (inkl. USt.)</span><input class="input" name="aufpreis" inputmode="decimal" value={euroInput(editing.surcharge ?? 0)} /></label>
			<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={editing.sortOrder ?? 0} /></label>
		</div>
		<ImageField name="bild" label="Musterbild" bind:value={image} aspect="1 / 1" />
		<label class="check"><input type="checkbox" name="standard" checked={editing.isDefault} /><span>Standard-Auswahl</span></label>
		<label class="check"><input type="checkbox" name="aktiv" checked={editing.active ?? true} /><span>Aktiv</span></label>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editing = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if editing.id}<button class="btn btn-danger" formaction="?/option_loeschen" formnovalidate onclick={(e) => !confirm('Option löschen?') && e.preventDefault()}>Löschen</button>{/if}
		</div>
	</form>
{/if}

{#if editingGroup}
	<div class="modal-bg" onclick={() => (editingGroup = null)} aria-hidden="true"></div>
	<form method="POST" action="?/gruppe" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editingGroup = null) })}>
		<h2 class="card-title">{editingGroup.id ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</h2>
		<input type="hidden" name="id" value={editingGroup.id ?? ''} />
		<div class="grid-2">
			<label class="field"><span class="label">Name</span><input class="input" name="name" required value={editingGroup.name ?? ''} placeholder="z. B. Premium Base" /></label>
			<label class="field"><span class="label">Englisch</span><input class="input" name="name_en" value={editingGroup.nameEn ?? ''} /></label>
		</div>
		<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={editingGroup.sortOrder ?? 0} /></label>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editingGroup = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if editingGroup.id}<button class="btn btn-danger" formaction="?/gruppe_loeschen" formnovalidate onclick={(e) => !confirm('Gruppe samt Optionen löschen?') && e.preventDefault()}>Löschen</button>{/if}
		</div>
	</form>
{/if}

<style>
	.group {
		margin-bottom: 1.25rem;
	}
	.g-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}
	.row {
		display: flex;
		gap: 0.4rem;
	}
	.opts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.opt {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
		width: 100%;
		padding: 0.6rem;
		border: 1px solid var(--c-line);
		border-radius: 10px;
		text-align: left;
	}
	.opt:hover {
		border-color: var(--c-line-strong);
	}
	.sw {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 7px;
		overflow: hidden;
		background: var(--c-surface-3);
	}
	.sw img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
