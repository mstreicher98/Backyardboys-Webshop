<script lang="ts">
	import { goto } from '$app/navigation';
	import Star from '@lucide/svelte/icons/star';
	import { DEKOR_TYPE_LABEL, euro, KIND_LABEL } from '$lib/admin-labels';

	let { data } = $props();
	const STATUS: Record<string, [string, string]> = { entwurf: ['Entwurf', 'badge-warn'], aktiv: ['Aktiv', 'badge-ok'], archiviert: ['Archiviert', ''] };
	const thumb = (s: string | null) => {
		if (!s) return null;
		const [file, widths] = s.split('|');
		const w = widths.split(',').map(Number).find((x) => x >= 200) ?? widths.split(',').map(Number).pop();
		return `/medien/${file}-${w}.webp`;
	};
	const cats = $derived(
		data.categories
			.filter((c) => !c.parentId)
			.flatMap((p) => [{ id: p.id, name: p.name }, ...data.categories.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, name: `– ${c.name}` }))])
	);
	function setParam(key: string, value: string) {
		const u = new URLSearchParams(location.search);
		if (value) u.set(key, value);
		else u.delete(key);
		goto(`?${u}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Produkte | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Produkte</h1>
		<p class="page-sub">{data.rows.length} {data.rows.length === 1 ? 'Produkt' : 'Produkte'}</p>
	</div>
	<a class="btn btn-primary" href="/admin/produkte/neu">Neues Produkt</a>
</div>

<div class="toolbar">
	<select class="select" value={data.status} onchange={(e) => setParam('status', e.currentTarget.value)} aria-label="Status">
		<option value="">Aktiv & Entwürfe</option>
		<option value="aktiv">Nur aktive</option>
		<option value="entwurf">Nur Entwürfe</option>
		<option value="archiviert">Archiviert</option>
	</select>
	<select class="select" value={data.kat ?? ''} onchange={(e) => setParam('kategorie', e.currentTarget.value)} aria-label="Kategorie">
		<option value="">Alle Kategorien</option>
		{#each cats as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
	</select>
	<form method="GET" class="grow">
		<input class="input" type="search" name="q" value={data.q} placeholder="Name oder Artikelnummer" aria-label="Suchen" />
	</form>
</div>

{#if data.rows.length}
	<div class="card table-wrap">
		<table class="table">
			<thead><tr><th></th><th>Produkt</th><th>Art</th><th class="num">Preis</th><th class="num">Lager</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.rows as p (p.id)}
					<tr>
						<td class="img-cell">{#if thumb(p.image)}<img src={thumb(p.image)} alt="" />{:else}<span class="ph"></span>{/if}</td>
						<td>
							<a class="row-link" href="/admin/produkte/{p.id}"><strong>{p.title}</strong></a>
							{#if p.featured}<span title="Hervorgehoben" class="star"><Star size={13} fill="currentColor" /></span>{/if}
							<br /><span class="muted small">/{p.slug}{p.variantCount > 1 ? ` · ${p.variantCount} Varianten` : ''}</span>
						</td>
						<td class="small">{p.dekorType ? DEKOR_TYPE_LABEL[p.dekorType] : KIND_LABEL[p.kind]}</td>
						<td class="num tabular">{p.minPrice != null ? euro(p.minPrice) : '–'}</td>
						<td class="num tabular">{p.stockMode === 'bestand' ? (p.stock ?? 0) : 'auf Bestellung'}</td>
						<td><span class="badge {STATUS[p.status][1]}">{STATUS[p.status][0]}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<div class="empty card card-pad">
		<p>{data.q || data.status || data.kat ? 'Keine Produkte gefunden.' : 'Noch keine Produkte. Leg das erste an – zum Beispiel dein Full-Custom-Dekor.'}</p>
	</div>
{/if}

<style>
	.table-wrap {
		overflow-x: auto;
	}
	.num {
		text-align: right;
	}
	.img-cell {
		width: 4.5rem;
	}
	.img-cell img,
	.ph {
		display: block;
		width: 4rem;
		height: 2.7rem;
		object-fit: cover;
		border-radius: 6px;
		background: var(--c-surface-3);
	}
	.star {
		display: inline-flex;
		margin-left: 0.3rem;
		color: var(--c-warn);
		vertical-align: middle;
	}
</style>
