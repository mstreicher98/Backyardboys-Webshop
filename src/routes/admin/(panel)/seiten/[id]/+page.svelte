<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import RichEditor from '$lib/components/admin/RichEditor.svelte';
	import SaveBar from '$lib/components/admin/SaveBar.svelte';
	import { submitting } from '$lib/formEnhance';

	let { data } = $props();
	const p = data.page;
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	let lang = $state<'de' | 'en'>('de');
	const PLACEHOLDERS = [
		['{{firma}}', 'Firmenwortlaut'],
		['{{marke}}', 'Markenname'],
		['{{strasse}}', 'Straße'],
		['{{plz}} {{ort}}', 'PLZ und Ort'],
		['{{email}}', 'E-Mail'],
		['{{telefon}}', 'Telefon'],
		['{{uid}}', 'UID-Nummer'],
		['{{fn}}', 'Firmenbuchnummer'],
		['{{gericht}}', 'Firmenbuchgericht'],
		['{{vertretung}}', 'Gesellschafter'],
		['{{versandtabelle}}', 'Versandkosten-Tabelle'],
		['{{zahlungsarten}}', 'Liste der Zahlungsarten'],
		['{{steuerhinweis}}', 'Hinweis USt./Kleinunternehmer'],
		['{{korrekturen}}', 'Anzahl Korrekturschleifen'],
		['{{abholung}}', 'Abholadresse']
	];
</script>

<svelte:head><title>{p.title || 'Neue Seite'} | BYB Intern</title></svelte:head>

<a href="/admin/seiten" class="back"><ArrowLeft size={16} /> Seiten</a>
<div class="page-head">
	<div>
		<h1 class="page-title">{p.title || 'Neue Seite'}</h1>
		{#if p.slug}<p class="page-sub">/info/{p.slug}</p>{/if}
	</div>
	{#if p.id}<a class="btn btn-ghost" href="/admin/zum-shop?pfad=/info/{p.slug}" target="_blank" rel="noopener"><ExternalLink size={16} /> Ansehen</a>{/if}
</div>

<form method="POST" action="?/speichern" class="cols" use:enhance={submitting(setBusy)}>
	<div class="card card-pad stack">
		<div class="lang" role="tablist" aria-label="Sprache">
			<button type="button" role="tab" aria-selected={lang === 'de'} onclick={() => (lang = 'de')}>Deutsch</button>
			<button type="button" role="tab" aria-selected={lang === 'en'} onclick={() => (lang = 'en')}>English</button>
		</div>
		<div class="stack" class:hidden={lang !== 'de'}>
			<label class="field"><span class="label">Titel</span><input class="input" name="titel" value={p.title} required /></label>
			<RichEditor name="inhalt" value={p.contentHtml} label="Inhalt" />
		</div>
		<div class="stack" class:hidden={lang !== 'en'}>
			<p class="hint">Leer = der englische Shop zeigt den deutschen Text.</p>
			<label class="field"><span class="label">Title</span><input class="input" name="titel_en" value={p.titleEn} /></label>
			<RichEditor name="inhalt_en" value={p.contentHtmlEn} label="Content" />
		</div>
		<SaveBar {busy} deleteConfirm={p.id && !data.protected ? 'Seite löschen?' : ''} />
	</div>
	<aside class="stack">
		<section class="card card-pad stack">
			<label class="field">
				<span class="label">Im Footer</span>
				<select class="select" name="bereich" value={p.group}>
					<option value="bestellung">Bestellung</option>
					<option value="hilfe">Hilfe</option>
					<option value="rechtliches">Rechtliches</option>
					<option value="keine">Nicht anzeigen</option>
				</select>
			</label>
			<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={p.sortOrder} /></label>
			<label class="field"><span class="label">Adresse</span><input class="input" name="slug" value={p.slug} disabled={data.protected} /></label>
		</section>
		<section class="card card-pad">
			<h2 class="card-title">Platzhalter</h2>
			<p class="card-sub">Einfach in den Text schreiben – im Shop steht dann der aktuelle Wert aus den Einstellungen.</p>
			<dl class="ph">
				{#each PLACEHOLDERS as [code, label] (code)}<div><dt><code>{code}</code></dt><dd>{label}</dd></div>{/each}
			</dl>
		</section>
	</aside>
</form>

<style>
	.cols {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1200px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 20rem;
			align-items: start;
		}
	}
	.hidden {
		display: none;
	}
	.lang {
		display: flex;
		gap: 0.25rem;
		padding: 0.2rem;
		border-radius: 9px;
		background: var(--c-surface-2);
		align-self: flex-start;
	}
	.lang button {
		padding: 0.35rem 0.9rem;
		border-radius: 7px;
		font-weight: 650;
		color: var(--c-ink-3);
	}
	.lang button[aria-selected='true'] {
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-1);
	}
	.ph {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}
	.ph div {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.ph dd {
		color: var(--c-ink-3);
		text-align: right;
	}
	code {
		font-size: 0.8rem;
	}
</style>
