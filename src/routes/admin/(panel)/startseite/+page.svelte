<script lang="ts">
	import { enhance } from '$app/forms';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Plus from '@lucide/svelte/icons/plus';
	import Star from '@lucide/svelte/icons/star';
	import ImageField from '$lib/components/admin/ImageField.svelte';
	import { submitting } from '$lib/formEnhance';
	import { mediaSrc, type MediaRef } from '$lib/media';

	let { data } = $props();
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	let hero = $state(data.hero);
	type Bike = (typeof data.gallery)[number];
	type Review = (typeof data.reviews)[number];
	let bike = $state<Partial<Bike> | null>(null);
	let bikeImage = $state<MediaRef | null>(null);
	let review = $state<Partial<Review> | null>(null);
	const h = data.home;
</script>

<svelte:head><title>Startseite | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Startseite</h1>
		<p class="page-sub">Hervorgehobene Produkte wählst du direkt beim Produkt („Auf der Startseite zeigen“).</p>
	</div>
	<a class="btn btn-ghost" href="/admin/zum-shop" target="_blank" rel="noopener"><ExternalLink size={16} /> Ansehen</a>
</div>

<form method="POST" action="?/hero" class="card card-pad stack block" use:enhance={submitting(setBusy)}>
	<h2 class="card-title">Oben auf der Seite</h2>
	<ImageField name="bild" label="Titelbild" bind:value={hero} hint="Leer = Foto aus dem Prototyp. Hochformat oder quadratisch, das Motiv eher rechts." aspect="4 / 3" />
	<div class="grid-2">
		<label class="field"><span class="label">Überschrift</span><input class="input" name="titel" value={h.heroTitle} maxlength="120" /><span class="hint">Jeder Satz kommt in eine eigene Zeile.</span></label>
		<label class="field"><span class="label">Englisch</span><input class="input" name="titel_en" value={h.heroTitleEn} maxlength="120" /></label>
	</div>
	<div class="grid-2">
		<label class="field"><span class="label">Text</span><textarea class="textarea" name="text" rows="3" maxlength="400">{h.heroText}</textarea></label>
		<label class="field"><span class="label">Englisch</span><textarea class="textarea" name="text_en" rows="3" maxlength="400">{h.heroTextEn}</textarea></label>
	</div>
	<div class="grid-2">
		<label class="field"><span class="label">Hinweisleiste ganz oben <span class="opt">(leer = aus)</span></span><input class="input" name="hinweis" value={h.notice} maxlength="200" placeholder="z. B. Betriebsurlaub bis 15. August – Bestellungen werden danach bearbeitet" /></label>
		<label class="field"><span class="label">Englisch</span><input class="input" name="hinweis_en" value={h.noticeEn} maxlength="200" /></label>
	</div>
	<div><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
</form>

<section class="card card-pad block">
	<div class="head">
		<div>
			<h2 class="card-title">Kundenbikes</h2>
			<p class="card-sub">Fotos nur mit Zustimmung der Kunden verwenden.</p>
		</div>
		<button type="button" class="btn btn-sm" onclick={() => ((bike = { active: true, sortOrder: 0 }), (bikeImage = null))}><Plus size={15} /> Foto</button>
	</div>
	{#if data.gallery.length}
		<ul class="gallery">
			{#each data.gallery as g (g.id)}
				<li>
					<button type="button" onclick={() => ((bike = { ...g }), (bikeImage = g.image))} class:off={!g.active}>
						<img src={mediaSrc(g.image, 400)} alt="" />
						<span class="small"><strong>{g.title || 'ohne Titel'}</strong><br />{g.bike}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Noch keine Kundenbikes – der Bereich ist auf der Startseite ausgeblendet.</p>
	{/if}
</section>

<section class="card card-pad block">
	<div class="head">
		<h2 class="card-title">Bewertungen</h2>
		<button type="button" class="btn btn-sm" onclick={() => (review = { rating: 5, active: true, sortOrder: 0 })}><Plus size={15} /> Bewertung</button>
	</div>
	{#if data.reviews.length}
		<ul class="reviews">
			{#each data.reviews as r (r.id)}
				<li class:off={!r.active}>
					<button type="button" onclick={() => (review = { ...r })}>
						<span class="stars">{#each Array(r.rating) as _, n (n)}<Star size={13} fill="currentColor" />{/each}</span>
						<span>„{r.text}“</span>
						<span class="muted small">{r.name}{r.bike ? ` · ${r.bike}` : ''}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Noch keine Bewertungen – der Bereich ist ausgeblendet.</p>
	{/if}
</section>

{#if bike}
	<div class="modal-bg" onclick={() => (bike = null)} aria-hidden="true"></div>
	<form method="POST" action="?/bike" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (bike = null) })}>
		<h2 class="card-title">{bike.id ? 'Kundenbike bearbeiten' : 'Kundenbike hinzufügen'}</h2>
		<input type="hidden" name="id" value={bike.id ?? ''} />
		<ImageField name="bild" label="Foto" bind:value={bikeImage} aspect="4 / 5" />
		<div class="grid-2">
			<label class="field"><span class="label">Titel</span><input class="input" name="titel" value={bike.title ?? ''} placeholder="z. B. Japan Edition" /></label>
			<label class="field"><span class="label">Bike</span><input class="input" name="bike" value={bike.bike ?? ''} placeholder="KTM EXC 300, 2021" /></label>
		</div>
		<label class="field">
			<span class="label">Zum Produkt <span class="opt">(optional)</span></span>
			<select class="select" name="produkt" value={bike.productId ?? ''}><option value="">–</option>{#each data.products as p (p.id)}<option value={p.id}>{p.title}</option>{/each}</select>
		</label>
		<div class="grid-2">
			<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={bike.sortOrder ?? 0} /></label>
			<label class="check"><input type="checkbox" name="aktiv" checked={bike.active} /><span>Anzeigen</span></label>
		</div>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (bike = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if bike.id}<button class="btn btn-danger" formaction="?/bike_loeschen" formnovalidate onclick={(e) => !confirm('Entfernen?') && e.preventDefault()}>Entfernen</button>{/if}
		</div>
	</form>
{/if}

{#if review}
	<div class="modal-bg" onclick={() => (review = null)} aria-hidden="true"></div>
	<form method="POST" action="?/bewertung" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (review = null) })}>
		<h2 class="card-title">{review.id ? 'Bewertung bearbeiten' : 'Neue Bewertung'}</h2>
		<input type="hidden" name="id" value={review.id ?? ''} />
		<div class="grid-2">
			<label class="field"><span class="label">Name</span><input class="input" name="name" required value={review.name ?? ''} placeholder="z. B. Lukas M." /></label>
			<label class="field"><span class="label">Bike</span><input class="input" name="bike" value={review.bike ?? ''} /></label>
		</div>
		<label class="field"><span class="label">Text</span><textarea class="textarea" name="text" rows="3" required>{review.text ?? ''}</textarea></label>
		<label class="field"><span class="label">Englisch</span><textarea class="textarea" name="text_en" rows="3">{review.textEn ?? ''}</textarea></label>
		<div class="grid-2">
			<label class="field"><span class="label">Sterne</span><select class="select" name="sterne" value={review.rating ?? 5}>{#each [5, 4, 3, 2, 1] as n (n)}<option value={n}>{n}</option>{/each}</select></label>
			<label class="field"><span class="label">Sortierung</span><input class="input" type="number" name="sortierung" value={review.sortOrder ?? 0} /></label>
		</div>
		<label class="check"><input type="checkbox" name="aktiv" checked={review.active} /><span>Anzeigen</span></label>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (review = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if review.id}<button class="btn btn-danger" formaction="?/bewertung_loeschen" formnovalidate onclick={(e) => !confirm('Entfernen?') && e.preventDefault()}>Entfernen</button>{/if}
		</div>
	</form>
{/if}

<style>
	.block {
		margin-bottom: 1.25rem;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}
	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.75rem;
	}
	.gallery button {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 100%;
		text-align: left;
	}
	.gallery img {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		border-radius: 8px;
	}
	.off {
		opacity: 0.5;
	}
	.reviews {
		display: flex;
		flex-direction: column;
	}
	.reviews li {
		border-bottom: 1px solid var(--c-line);
	}
	.reviews button {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		padding: 0.7rem 0;
		text-align: left;
	}
	.stars {
		display: flex;
		color: var(--c-warn);
	}
</style>
