<script lang="ts">
	import { enhance } from '$app/forms';
	import ImageField from '$lib/components/admin/ImageField.svelte';
	import RichEditor from '$lib/components/admin/RichEditor.svelte';
	import { submitting } from '$lib/formEnhance';
	import { mediaSrc } from '$lib/media';

	let { data } = $props();
	type Row = (typeof data.rows)[number];
	let editing = $state<Partial<Row> | null>(null);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	const top = $derived(data.rows.filter((r) => !r.parentId));
	const kids = (id: number) => data.rows.filter((r) => r.parentId === id);
	let image = $state<Row['image']>(null);
	function edit(r: Partial<Row>) {
		editing = { active: true, showInMenu: true, sortOrder: 0, ...r };
		image = r.image ?? null;
	}
</script>

<svelte:head><title>Kategorien | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Kategorien</h1>
		<p class="page-sub">Oberkategorien erscheinen im Menü mit Bild, Unterkategorien darunter – wie im Mega-Menü des Shops.</p>
	</div>
	<button type="button" class="btn btn-primary" onclick={() => edit({})}>Neue Kategorie</button>
</div>

<div class="layout">
	<div class="card">
		<ul class="tree">
			{#each top as c (c.id)}
				<li>
					{@render row(c, false)}
					{#if kids(c.id).length}
						<ul>{#each kids(c.id) as k (k.id)}<li>{@render row(k, true)}</li>{/each}</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	{#if editing}
		<form method="POST" action="?/speichern" class="card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editing = null) })}>
			<h2 class="card-title">{editing.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
			<input type="hidden" name="id" value={editing.id ?? ''} />
			<div class="grid-2">
				<label class="field"><span class="label">Name</span><input class="input" name="name" required value={editing.name ?? ''} /></label>
				<label class="field"><span class="label">Englisch</span><input class="input" name="name_en" value={editing.nameEn ?? ''} /></label>
			</div>
			<div class="grid-2">
				<label class="field"><span class="label">Zusatz im Menü</span><input class="input" name="zusatz" value={editing.tagline ?? ''} placeholder="z. B. Premium Dekor" /></label>
				<label class="field"><span class="label">Englisch</span><input class="input" name="zusatz_en" value={editing.taglineEn ?? ''} /></label>
			</div>
			<div class="grid-2">
				<label class="field">
					<span class="label">Oberkategorie</span>
					<select class="select" name="eltern" value={editing.parentId ?? ''}>
						<option value="">– keine (erscheint im Hauptmenü)</option>
						{#each top.filter((t) => t.id !== editing?.id) as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
					</select>
				</label>
				<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={editing.sortOrder ?? 0} /></label>
			</div>
			<ImageField name="bild" label="Bild" bind:value={image} />
			<RichEditor name="beschreibung" value={editing.descriptionHtml ?? ''} label="Beschreibung (optional)" />
			<RichEditor name="beschreibung_en" value={editing.descriptionHtmlEn ?? ''} label="Beschreibung englisch" />
			<label class="field"><span class="label">Adresse <span class="opt">(leer = aus Name)</span></span><input class="input" name="slug" value={editing.slug ?? ''} /></label>
			<label class="check"><input type="checkbox" name="aktiv" checked={editing.active} /><span>Aktiv</span></label>
			<label class="check"><input type="checkbox" name="menue" checked={editing.showInMenu} /><span>Im Menü zeigen</span></label>
			<div class="actionbar">
				<button class="btn btn-primary" disabled={busy}>Speichern</button>
				<button type="button" class="btn btn-ghost" onclick={() => (editing = null)}>Abbrechen</button>
				<span class="spacer"></span>
				{#if editing.id}
					<button class="btn btn-danger" formaction="?/loeschen" formnovalidate disabled={busy} onclick={(e) => !confirm('Kategorie löschen? Produkte bleiben erhalten.') && e.preventDefault()}>Löschen</button>
				{/if}
			</div>
		</form>
	{/if}
</div>

{#snippet row(c: Row, child: boolean)}
	<button type="button" class="row" class:child onclick={() => edit(c)}>
		<span class="thumb">{#if c.image}<img src={mediaSrc(c.image, 200)} alt="" />{/if}</span>
		<span class="grow"><strong>{c.name}</strong>{#if c.tagline}<span class="muted small"> · {c.tagline}</span>{/if}<br /><span class="muted small">/kategorie/{c.slug} · {c.products} Produkte</span></span>
		{#if !c.active}<span class="badge">inaktiv</span>{:else if !c.showInMenu}<span class="badge">nicht im Menü</span>{/if}
	</button>
{/snippet}

<style>
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
	.tree > li {
		border-bottom: 1px solid var(--c-line);
	}
	.tree ul {
		padding-left: 2rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.7rem 1rem;
		text-align: left;
	}
	.row:hover {
		background: var(--c-surface-2);
	}
	.thumb {
		width: 3.5rem;
		height: 2.4rem;
		border-radius: 6px;
		overflow: hidden;
		background: var(--c-surface-3);
		flex-shrink: 0;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.grow {
		flex: 1;
	}
</style>
