<script lang="ts">
	import { formatStamp } from '$lib/format';

	let { data } = $props();
	const GROUPS: Record<string, string> = { bestellung: 'Footer: Bestellung', hilfe: 'Footer: Hilfe', rechtliches: 'Rechtliches', keine: 'Nicht im Footer' };
	const groups = $derived(Object.keys(GROUPS).map((g) => ({ key: g, label: GROUPS[g], rows: data.rows.filter((r) => r.group === g) })).filter((g) => g.rows.length));
</script>

<svelte:head><title>Seiten | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Seiten</h1>
		<p class="page-sub">Info- und Rechtstexte. Firmenangaben, Versandkosten und Zahlungsarten kommen automatisch aus den Einstellungen.</p>
	</div>
	<a class="btn btn-primary" href="/admin/seiten/neu">Neue Seite</a>
</div>

<p class="alert alert-warn legal">Die Rechtstexte sind Vorlagen nach österreichischem Recht. Bitte vor dem Livegang von einer fachkundigen Stelle prüfen lassen (z. B. WKO-Rechtsservice).</p>

{#each groups as g (g.key)}
	<section class="card block">
		<h2 class="card-title pad">{g.label}</h2>
		<table class="table">
			<tbody>
				{#each g.rows as r (r.id)}
					<tr>
						<td><a class="row-link" href="/admin/seiten/{r.id}"><strong>{r.title}</strong></a><br /><span class="muted small">/info/{r.slug}</span></td>
						<td class="small">{r.hasEn ? 'DE + EN' : 'nur DE'}</td>
						<td class="muted small">geändert {formatStamp(r.updatedAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/each}

<style>
	.legal {
		margin-bottom: 1.25rem;
	}
	.block {
		margin-bottom: 1.25rem;
	}
	.pad {
		padding: 1rem 1rem 0.25rem;
	}
</style>
