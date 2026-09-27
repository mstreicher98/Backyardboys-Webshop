<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import GalleryField from '$lib/components/admin/GalleryField.svelte';
	import RichEditor from '$lib/components/admin/RichEditor.svelte';
	import SaveBar from '$lib/components/admin/SaveBar.svelte';
	import { euroInput, parseEuro } from '$lib/admin-labels';
	import { submitting } from '$lib/formEnhance';
	import { emptyField, FIELD_PRESETS, FIELD_TYPE_LABELS } from '$lib/product-presets';
	import type { FieldType, PersonalizationField, ProductOption } from '$lib/shop-types';

	let { data } = $props();
	const p = data.product;

	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);

	/* ---------------- Grunddaten */
	let kind = $state(p.kind);
	let dekorType = $state(p.dekorType ?? '');
	let stockMode = $state(p.stockMode);
	let images = $state(data.images);
	let lang = $state<'de' | 'en'>('de');

	/* ---------------- Optionen und Varianten */
	let options = $state<ProductOption[]>(structuredClone(p.options));
	type Row = { id: number | null; values: string[]; sku: string; price: string; compareAt: string; dealerPrice: string; stock: number; active: boolean };
	let rows = $state<Row[]>(
		data.variants.length
			? data.variants.map((v) => ({ id: v.id, values: v.values, sku: v.sku, price: euroInput(v.price), compareAt: euroInput(v.compareAt), dealerPrice: euroInput(v.dealerPrice), stock: v.stock, active: v.active }))
			: [{ id: null, values: [], sku: '', price: '', compareAt: '', dealerPrice: '', stock: 0, active: true }]
	);

	function combos(opts: ProductOption[]): string[][] {
		return opts.reduce<string[][]>((acc, o) => acc.flatMap((a) => o.values.filter((v) => v.de.trim()).map((v) => [...a, v.de.trim()])), [[]]);
	}
	/** Varianten an die Optionen anpassen – vorhandene Preise bleiben erhalten */
	function syncRows() {
		const clean = options.filter((o) => o.name.trim() && o.values.some((v) => v.de.trim()));
		const wanted = combos(clean);
		const byKey = new Map(rows.map((r) => [JSON.stringify(r.values), r]));
		const template = rows[0];
		const used = new Set<Row>();
		rows = wanted.map((values) => {
			const exact = byKey.get(JSON.stringify(values));
			if (exact) {
				used.add(exact);
				return exact;
			}
			// Neue Option dazugekommen: die bisherige Variante lebt in der ersten passenden Kombination weiter
			// (gleiche ID → Lagerstand und Warenkörbe bleiben), weitere Kombinationen übernehmen die Preise
			const parent = rows.find((r) => r.values.length < values.length && r.values.every((v) => values.includes(v)));
			if (parent && !used.has(parent)) {
				used.add(parent);
				return { ...parent, values };
			}
			const base = parent ?? template;
			return { id: null, values, sku: '', price: base?.price ?? '', compareAt: base?.compareAt ?? '', dealerPrice: base?.dealerPrice ?? '', stock: 0, active: true };
		});
	}
	const addOption = () => {
		options = [...options, { name: '', nameEn: '', values: [{ de: '', en: '' }] }];
	};

	/* ---------------- Personalisierung */
	let fields = $state<PersonalizationField[]>(structuredClone(p.fields));
	let openField = $state<number | null>(null);
	function usePreset() {
		if (!dekorType || !(dekorType in FIELD_PRESETS)) return;
		if (fields.length && !confirm('Die bisherigen Felder werden durch die Vorlage ersetzt. Fortfahren?')) return;
		fields = structuredClone(FIELD_PRESETS[dekorType as keyof typeof FIELD_PRESETS]);
	}
	function moveField(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= fields.length) return;
		const next = [...fields];
		[next[i], next[j]] = [next[j], next[i]];
		fields = next;
	}

	/* ---------------- Bikes */
	let fits = $state(structuredClone(data.fits));
	let addBrand = $state<number | ''>('');
	let addModel = $state<number | ''>('');
	const brandModels = $derived(addBrand === '' ? [] : data.models.filter((m) => m.brandId === addBrand));
	const modelLabel = (id: number) => {
		const m = data.models.find((x) => x.id === id);
		const b = m ? data.brands.find((x) => x.id === m.brandId) : null;
		return m ? `${b?.name ?? ''} ${m.name} (${m.yearFrom}–${m.yearTo ?? 'heute'})` : `Modell ${id}`;
	};

	/* ---------------- Bundle */
	let bundle = $state(structuredClone(data.bundle));

	const payload = $derived(
		JSON.stringify({
			options,
			variants: rows,
			fields,
			bikes: fits,
			bundle
		})
	);

	const topCats = $derived(data.categories.filter((c) => !c.parentId));
	const childCats = (id: number) => data.categories.filter((c) => c.parentId === id);
	const surchargeText = (n: number) => euroInput(n);
</script>

<svelte:head><title>{data.isNew ? 'Neues Produkt' : p.title} | BYB Intern</title></svelte:head>

<a href="/admin/produkte" class="back"><ArrowLeft size={16} /> Produkte</a>
<div class="page-head">
	<div>
		<h1 class="page-title">{data.isNew ? 'Neues Produkt' : p.title}</h1>
		{#if !data.isNew}<p class="page-sub">/produkt/{p.slug}</p>{/if}
	</div>
	{#if !data.isNew}
		<div class="head-actions">
			<a class="btn btn-ghost" href="/admin/zum-shop?pfad=/produkt/{p.slug}" target="_blank" rel="noopener"><ExternalLink size={16} /> Ansehen</a>
			<form method="POST" action="?/kopieren" use:enhance><button class="btn btn-ghost"><Copy size={16} /> Kopieren</button></form>
		</div>
	{/if}
</div>

<form method="POST" action="?/speichern" class="editor" use:enhance={submitting(setBusy)}>
	<input type="hidden" name="daten" value={payload} />

	<div class="cols">
		<div class="main">
			<!-- Grunddaten -->
			<section class="card card-pad stack">
				<div class="lang" role="tablist" aria-label="Sprache">
					<button type="button" role="tab" aria-selected={lang === 'de'} onclick={() => (lang = 'de')}>Deutsch</button>
					<button type="button" role="tab" aria-selected={lang === 'en'} onclick={() => (lang = 'en')}>English</button>
				</div>
				<div class:hidden={lang !== 'de'} class="stack">
					<label class="field"><span class="label">Titel</span><input class="input" name="titel" value={p.title} maxlength="150" required={lang === 'de'} /></label>
					<label class="field"><span class="label">Untertitel <span class="opt">(optional)</span></span><input class="input" name="untertitel" value={p.subtitle} maxlength="200" /></label>
					<RichEditor name="beschreibung" value={p.descriptionHtml} label="Beschreibung" />
					<label class="field"><span class="label">Lieferzeit <span class="opt">(z. B. „2–3 Wochen“)</span></span><input class="input" name="lieferzeit" value={p.leadTime} maxlength="80" /></label>
				</div>
				<div class:hidden={lang !== 'en'} class="stack">
					<p class="hint">Leere Felder zeigen im englischen Shop den deutschen Text.</p>
					<label class="field"><span class="label">Title</span><input class="input" name="titel_en" value={p.titleEn} maxlength="150" /></label>
					<label class="field"><span class="label">Subtitle</span><input class="input" name="untertitel_en" value={p.subtitleEn} maxlength="200" /></label>
					<RichEditor name="beschreibung_en" value={p.descriptionHtmlEn} label="Description" />
					<label class="field"><span class="label">Delivery time</span><input class="input" name="lieferzeit_en" value={p.leadTimeEn} maxlength="80" /></label>
				</div>
			</section>

			<section class="card card-pad">
				<GalleryField name="bilder" label="Bilder" bind:value={images} />
				<p class="hint">Das erste Bild erscheint in Listen, das zweite beim Darüberfahren. Querformat 3:2 passt am besten.</p>
			</section>

			<!-- Varianten -->
			<section class="card card-pad stack">
				<div>
					<h2 class="card-title">{kind === 'gutschein' ? 'Gutscheinwerte' : 'Varianten & Preise'}</h2>
					<p class="card-sub">
						{kind === 'gutschein'
							? 'Lege eine Option „Wert“ mit z. B. 25 €, 50 €, 100 € an und trage den Preis = Wert ein.'
							: 'Preise inkl. USt. Ohne Optionen gibt es genau eine Variante.'}
					</p>
				</div>
				{#each options as opt, oi (oi)}
					<div class="option">
						<div class="grid-2">
							<label class="field"><span class="label">Option</span><input class="input" bind:value={opt.name} placeholder="z. B. Größe" onchange={syncRows} /></label>
							<label class="field"><span class="label">Englisch</span><input class="input" bind:value={opt.nameEn} placeholder="e.g. Size" /></label>
						</div>
						<div class="values">
							{#each opt.values as v, vi (vi)}
								<div class="value-row">
									<input class="input" bind:value={v.de} placeholder="Wert" aria-label="Wert" onchange={syncRows} />
									<input class="input" bind:value={v.en} placeholder="English" aria-label="Wert englisch" />
									<button type="button" class="btn btn-ghost btn-icon" aria-label="Wert entfernen" onclick={() => ((opt.values = opt.values.filter((_, k) => k !== vi)), syncRows())}><Trash size={16} /></button>
								</div>
							{/each}
						</div>
						<div class="row">
							<button type="button" class="btn btn-sm" onclick={() => (opt.values = [...opt.values, { de: '', en: '' }])}><Plus size={15} /> Wert</button>
							<button type="button" class="btn btn-sm btn-ghost" onclick={() => ((options = options.filter((_, k) => k !== oi)), syncRows())}>Option entfernen</button>
						</div>
					</div>
				{/each}
				{#if options.length < 3}<div><button type="button" class="btn btn-sm" onclick={addOption}><Plus size={15} /> Option hinzufügen (Größe, Farbe …)</button></div>{/if}

				<div class="table-wrap">
					<table class="table vtable">
						<thead>
							<tr>
								{#if options.length}<th>Variante</th>{/if}
								<th>Preis €</th>
								<th>Statt €</th>
								<th>Händler €</th>
								<th>Art.-Nr.</th>
								{#if stockMode === 'bestand'}<th>Bestand</th>{/if}
								<th>Aktiv</th>
							</tr>
						</thead>
						<tbody>
							{#each rows as r (JSON.stringify(r.values))}
								<tr>
									{#if options.length}<td class="vname">{r.values.join(' / ')}</td>{/if}
									<td><input class="input sm" bind:value={r.price} inputmode="decimal" required aria-label="Preis" /></td>
									<td><input class="input sm" bind:value={r.compareAt} inputmode="decimal" aria-label="Vergleichspreis" /></td>
									<td><input class="input sm" bind:value={r.dealerPrice} inputmode="decimal" placeholder="Rabatt" aria-label="Händlerpreis" /></td>
									<td><input class="input sm" bind:value={r.sku} aria-label="Artikelnummer" /></td>
									{#if stockMode === 'bestand'}<td><input class="input sm" type="number" bind:value={r.stock} aria-label="Bestand" /></td>{/if}
									<td><input type="checkbox" bind:checked={r.active} aria-label="Aktiv" /></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="hint">„Statt“ wird durchgestrichen angezeigt. „Händler“ leer lassen = Standard-Händlerrabatt aus den Einstellungen.</p>
			</section>

			{#if kind === 'dekor' || kind === 'standard'}
				<!-- Personalisierung -->
				<section class="card card-pad stack">
					<div class="sec-head">
						<div>
							<h2 class="card-title">Personalisierung</h2>
							<p class="card-sub">Felder, die der Kunde beim Bestellen ausfüllt. Aufpreise kommen dazu, wenn das Feld ausgefüllt ist.</p>
						</div>
						{#if kind === 'dekor' && dekorType}<button type="button" class="btn btn-sm" onclick={usePreset}>Vorlage „{dekorType === 'full_custom' ? 'Full Custom' : dekorType === 'semi_custom' ? 'Semi Custom' : 'Reprint'}“ laden</button>{/if}
					</div>
					{#each fields as fld, i (fld.key + i)}
						<div class="fieldcard">
							<div class="fc-head">
								<button type="button" class="fc-title" onclick={() => (openField = openField === i ? null : i)} aria-expanded={openField === i}>
									<strong>{fld.label || 'Neues Feld'}</strong>
									<span class="muted small">{FIELD_TYPE_LABELS[fld.type]}{fld.required ? ' · Pflicht' : ''}{fld.surcharge ? ` · + ${surchargeText(fld.surcharge)} €` : ''}</span>
								</button>
								<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Nach oben" onclick={() => moveField(i, -1)}><ChevronUp size={16} /></button>
								<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Nach unten" onclick={() => moveField(i, 1)}><ChevronDown size={16} /></button>
								<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Feld entfernen" onclick={() => (fields = fields.filter((_, k) => k !== i))}><Trash size={16} /></button>
							</div>
							{#if openField === i}
								<div class="stack fc-body">
									<div class="grid-2">
										<label class="field">
											<span class="label">Art</span>
											<select class="select" bind:value={fld.type}>
												{#each Object.entries(FIELD_TYPE_LABELS) as [k, l] (k)}<option value={k as FieldType}>{l}</option>{/each}
											</select>
										</label>
										<label class="field"><span class="label">Aufpreis €</span><input class="input" inputmode="decimal" value={surchargeText(fld.surcharge)} onchange={(e) => (fld.surcharge = parseEuro(e.currentTarget.value) ?? 0)} /></label>
									</div>
									<div class="grid-2">
										<label class="field"><span class="label">Bezeichnung</span><input class="input" bind:value={fld.label} /></label>
										<label class="field"><span class="label">Englisch</span><input class="input" bind:value={fld.labelEn} /></label>
									</div>
									<div class="grid-2">
										<label class="field"><span class="label">Hilfetext</span><input class="input" bind:value={fld.help} /></label>
										<label class="field"><span class="label">Englisch</span><input class="input" bind:value={fld.helpEn} /></label>
									</div>
									{#if fld.type === 'text' || fld.type === 'textarea' || fld.type === 'number'}
										<div class="grid-2">
											<label class="field"><span class="label">Beispiel im Feld</span><input class="input" bind:value={fld.placeholder} /></label>
											<label class="field"><span class="label">Englisch</span><input class="input" bind:value={fld.placeholderEn} /></label>
										</div>
										<label class="field short"><span class="label">Max. Zeichen</span><input class="input" type="number" min="1" max="4000" bind:value={fld.maxLength} /></label>
									{/if}
									{#if fld.type === 'select'}
										<label class="field">
											<span class="label">Auswahl – eine je Zeile, Englisch nach „|“</span>
											<textarea
												class="textarea"
												rows="4"
												value={fld.choices.map((c) => (c.en ? `${c.de} | ${c.en}` : c.de)).join('\n')}
												onchange={(e) =>
													(fld.choices = e.currentTarget.value
														.split('\n')
														.map((l) => l.split('|').map((x) => x.trim()))
														.filter(([de]) => de)
														.map(([de, en]) => ({ de, en: en ?? '' })))}
											></textarea>
										</label>
									{/if}
									{#if fld.type === 'datei'}
										<label class="field short"><span class="label">Max. Dateien</span><input class="input" type="number" min="1" max="10" bind:value={fld.maxFiles} /></label>
									{/if}
									<label class="check"><input type="checkbox" bind:checked={fld.required} /><span>Pflichtfeld</span></label>
								</div>
							{/if}
						</div>
					{/each}
					<div><button type="button" class="btn btn-sm" onclick={() => ((fields = [...fields, emptyField()]), (openField = fields.length - 1))}><Plus size={15} /> Feld hinzufügen</button></div>
				</section>
			{/if}

			{#if kind === 'dekor'}
				<section class="card card-pad stack">
					<div>
						<h2 class="card-title">Passt für</h2>
						<p class="card-sub">Für den Bike-Finder. Baujahre leer lassen = alle Baujahre des Modells.</p>
					</div>
					<label class="check"><input type="checkbox" name="passt_alle" checked={p.universalFit} /><span>Passt auf jedes Bike (z. B. Full Custom) – erscheint im Bike-Finder immer</span></label>
					{#if fits.length}
						<ul class="fits">
							{#each fits as fit, i (fit.modelId)}
								<li>
									<span class="grow">{modelLabel(fit.modelId)}</span>
									<input class="input sm" type="number" placeholder="von" bind:value={fit.yearFrom} aria-label="Baujahr von" />
									<input class="input sm" type="number" placeholder="bis" bind:value={fit.yearTo} aria-label="Baujahr bis" />
									<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Entfernen" onclick={() => (fits = fits.filter((_, k) => k !== i))}><Trash size={16} /></button>
								</li>
							{/each}
						</ul>
					{/if}
					{#if data.brands.length}
						<div class="add-fit">
							<select class="select" bind:value={addBrand} aria-label="Marke"><option value="">Marke …</option>{#each data.brands as b (b.id)}<option value={b.id}>{b.name}</option>{/each}</select>
							<select class="select" bind:value={addModel} disabled={addBrand === ''} aria-label="Modell"><option value="">Modell …</option>{#each brandModels as m (m.id)}<option value={m.id}>{m.name}</option>{/each}</select>
							<button
								type="button"
								class="btn btn-sm"
								disabled={addModel === '' || fits.some((f) => f.modelId === addModel)}
								onclick={() => {
									if (addModel !== '') fits = [...fits, { modelId: addModel, yearFrom: null, yearTo: null }];
									addModel = '';
								}}><Plus size={15} /> Hinzufügen</button
							>
						</div>
						<p class="hint">Modell fehlt? Unter <a href="/admin/bikes">Bike-Datenbank</a> anlegen.</p>
					{:else}
						<p class="hint">Noch keine Modelle – zuerst in der <a href="/admin/bikes">Bike-Datenbank</a> anlegen.</p>
					{/if}
				</section>
			{/if}

			{#if kind === 'bundle'}
				<section class="card card-pad stack">
					<div>
						<h2 class="card-title">Im Bundle enthalten</h2>
						<p class="card-sub">Haben Bestandteile mehrere Varianten (z. B. Größe), wählt der Kunde beim Bestellen. Lager wird bei den Bestandteilen abgebucht.</p>
					</div>
					{#each bundle as b, i (i)}
						<div class="bundle-row">
							<select class="select grow" bind:value={b.productId} aria-label="Produkt">
								<option value={0}>Produkt wählen …</option>
								{#each data.others as o (o.id)}<option value={o.id}>{o.title}</option>{/each}
							</select>
							<input class="input sm" type="number" min="1" bind:value={b.quantity} aria-label="Menge" />
							<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Entfernen" onclick={() => (bundle = bundle.filter((_, k) => k !== i))}><Trash size={16} /></button>
						</div>
					{/each}
					<div><button type="button" class="btn btn-sm" onclick={() => (bundle = [...bundle, { productId: 0, quantity: 1 }])}><Plus size={15} /> Bestandteil</button></div>
				</section>
			{/if}
		</div>

		<aside class="side">
			<section class="card card-pad stack">
				<label class="field">
					<span class="label">Status</span>
					<select class="select" name="status" value={p.status}>
						<option value="entwurf">Entwurf – nicht sichtbar</option>
						<option value="aktiv">Aktiv – im Shop</option>
						<option value="archiviert">Archiviert</option>
					</select>
				</label>
				<label class="field">
					<span class="label">Art</span>
					<select class="select" name="art" bind:value={kind}>
						<option value="standard">Artikel (Kleidung, Sticker, Pflege …)</option>
						<option value="dekor">Dekor</option>
						<option value="gutschein">Gutschein</option>
						<option value="bundle">Bundle</option>
					</select>
				</label>
				{#if kind === 'dekor'}
					<label class="field">
						<span class="label">Dekor-Art</span>
						<select class="select" name="dekortyp" bind:value={dekorType} required>
							<option value="">Bitte wählen</option>
							<option value="full_custom">Full Custom (Anzahlung, Entwurf, Restzahlung)</option>
							<option value="semi_custom">Semi Custom (Vorlage, personalisiert)</option>
							<option value="reprint">Reprint</option>
						</select>
					</label>
					{#if dekorType === 'full_custom'}<p class="hint">Der Preis der Variante ist die <strong>Anzahlung</strong>. Den Endpreis legst du im Auftrag fest.</p>{/if}
				{/if}
				<label class="check"><input type="checkbox" name="hervorgehoben" checked={p.featured} /><span>Auf der Startseite zeigen</span></label>
				<label class="field short"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={p.sortOrder} /></label>
				<label class="field"><span class="label">Adresse <span class="opt">(leer = aus Titel)</span></span><input class="input" name="slug" value={p.slug} /></label>
			</section>

			<section class="card card-pad stack">
				<h2 class="card-title">Kategorien</h2>
				<div class="cats">
					{#each topCats as c (c.id)}
						<label class="check"><input type="checkbox" name="kategorien" value={c.id} checked={data.categoryIds.includes(c.id)} /><span>{c.name}</span></label>
						{#each childCats(c.id) as ch (ch.id)}
							<label class="check sub"><input type="checkbox" name="kategorien" value={ch.id} checked={data.categoryIds.includes(ch.id)} /><span>{ch.name}</span></label>
						{/each}
					{/each}
				</div>
			</section>

			{#if kind === 'dekor' && data.groups.length}
				<section class="card card-pad stack">
					<h2 class="card-title">Base & Finish</h2>
					{#each data.groups as g (g.id)}
						<label class="check"><input type="checkbox" name="upgrades" value={g.id} checked={p.upgradeGroupIds.includes(g.id) || (data.isNew && kind === 'dekor')} /><span>{g.name}</span></label>
					{/each}
					<p class="hint">Aufpreise unter <a href="/admin/upgrades">Base & Finish</a>.</p>
				</section>
			{/if}

			{#if kind !== 'gutschein'}
				<section class="card card-pad stack">
					<h2 class="card-title">Lager & Versand</h2>
					<div class="segmented">
						<label><input type="radio" name="lager" value="auf_bestellung" bind:group={stockMode} /><span>Auf Bestellung</span></label>
						<label><input type="radio" name="lager" value="bestand" bind:group={stockMode} /><span>Lagerbestand</span></label>
					</div>
					{#if stockMode === 'bestand'}<label class="check"><input type="checkbox" name="nachlieferung" checked={p.backorder} /><span>Auch bei Bestand 0 verkaufen (Nachlieferung)</span></label>{/if}
					<label class="field"><span class="label">Vorbestellung bis <span class="opt">(Erscheinungstag)</span></span><input class="input" type="date" name="erscheint" value={p.releaseDate ?? ''} /></label>
					<label class="check"><input type="checkbox" name="versand" checked={p.requiresShipping} /><span>Wird versendet</span></label>
					<label class="check"><input type="checkbox" name="haendlerrabatt" checked={p.dealerDiscountable} /><span>Händlerrabatt gilt</span></label>
				</section>
			{:else}
				<input type="hidden" name="haendlerrabatt" value="" />
			{/if}
		</aside>
	</div>

	<SaveBar {busy} deleteConfirm={data.isNew ? '' : data.hasOrders ? 'Das Produkt wurde schon bestellt und wird deshalb archiviert statt gelöscht. Fortfahren?' : 'Produkt endgültig löschen?'} deleteLabel={data.hasOrders ? 'Archivieren' : 'Löschen'} />
</form>

<style>
	.head-actions {
		display: flex;
		gap: 0.5rem;
	}
	.cols {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1200px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 21rem;
			align-items: start;
		}
		.side {
			position: sticky;
			top: 1.5rem;
		}
	}
	.main,
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
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
	.option {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem;
		border: 1px solid var(--c-line);
		border-radius: 10px;
	}
	.values {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.value-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.4rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.vtable td,
	.vtable th {
		padding: 0.35rem 0.4rem;
	}
	.vname {
		font-weight: 650;
		white-space: nowrap;
	}
	.input.sm {
		min-width: 5.5rem;
		height: 2.25rem;
		padding: 0 0.5rem;
	}
	.sec-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.fieldcard {
		border: 1px solid var(--c-line);
		border-radius: 10px;
	}
	.fc-head {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem 0.5rem 0.35rem 0.85rem;
	}
	.fc-title {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
		padding: 0.3rem 0;
	}
	.fc-body {
		padding: 0.25rem 0.85rem 0.9rem;
		border-top: 1px solid var(--c-line);
		padding-top: 0.85rem;
	}
	.short {
		max-width: 12rem;
	}
	.fits li,
	.bundle-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--c-line);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.add-fit {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.add-fit .select {
		flex: 1;
		min-width: 9rem;
	}
	.cats {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.cats .sub {
		padding-left: 1.4rem;
	}
</style>
