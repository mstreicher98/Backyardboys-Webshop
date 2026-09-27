<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import { euro } from '$lib/admin-labels';

	let { data } = $props();
	const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
	const sum = $derived(data.months.reduce((a, m) => ({ net: a.net + m.net, tax: a.tax + m.tax, total: a.total + m.total, count: a.count + m.count }), { net: 0, tax: 0, total: 0, count: 0 }));
	const max = $derived(Math.max(1, ...data.months.map((m) => m.total)));
	let from = $state(`${data.year}-01-01`);
	let to = $state(`${data.year}-12-31`);
</script>

<svelte:head><title>Berichte | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Berichte</h1>
		<p class="page-sub">Umsätze laut Rechnungen (Stornos abgezogen).</p>
	</div>
	<nav class="years">
		{#each data.years as y (y)}<a href="?jahr={y}" aria-current={y === data.year ? 'page' : undefined}>{y}</a>{/each}
	</nav>
</div>

<div class="kpis">
	<div class="card card-pad"><span class="k-label">Umsatz brutto {data.year}</span><span class="k-val tabular">{euro(sum.total)}</span></div>
	<div class="card card-pad"><span class="k-label">davon USt.</span><span class="k-val tabular">{euro(sum.tax)}</span></div>
	<div class="card card-pad"><span class="k-label">Rechnungen</span><span class="k-val tabular">{sum.count}</span></div>
</div>

<section class="card card-pad block">
	<h2 class="card-title">Nach Monaten</h2>
	<table class="table">
		<thead><tr><th>Monat</th><th class="bar-col"></th><th class="num">Netto</th><th class="num">USt.</th><th class="num">Brutto</th><th class="num">Rechnungen</th></tr></thead>
		<tbody>
			{#each data.months as m (m.month)}
				<tr>
					<td>{MONTHS[m.month - 1]}</td>
					<td class="bar-col"><span class="bar" style:width="{(Math.max(0, m.total) / max) * 100}%"></span></td>
					<td class="num tabular">{euro(m.net)}</td>
					<td class="num tabular">{euro(m.tax)}</td>
					<td class="num tabular"><strong>{euro(m.total)}</strong></td>
					<td class="num">{m.count}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<div class="grid">
	<section class="card card-pad">
		<h2 class="card-title">Zahlungseingänge nach Zahlungsart</h2>
		{#if data.pays.length}
			<table class="table">
				<tbody>
					{#each data.pays as p (p.method)}<tr><td>{p.method}</td><td class="num">{p.count}×</td><td class="num tabular">{euro(p.total)}</td></tr>{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty">Noch keine Zahlungen.</p>
		{/if}
	</section>
	<section class="card card-pad">
		<h2 class="card-title">Meistverkauft</h2>
		{#if data.top.length}
			<table class="table">
				<tbody>
					{#each data.top as t (t.title)}<tr><td>{t.title}</td><td class="num">{t.qty}×</td><td class="num tabular">{euro(t.total)}</td></tr>{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty">Noch keine Verkäufe.</p>
		{/if}
	</section>
</div>

<section class="card card-pad block">
	<h2 class="card-title">Export für die Buchhaltung</h2>
	<p class="card-sub">Alle Rechnungen im Zeitraum als CSV (Semikolon, öffnet direkt in Excel) oder alle PDFs gesammelt als ZIP.</p>
	<form method="GET" action="/admin/berichte/export" class="export">
		<label class="field"><span class="label">Von</span><input class="input" type="date" name="von" bind:value={from} required /></label>
		<label class="field"><span class="label">Bis</span><input class="input" type="date" name="bis" bind:value={to} required /></label>
		<button class="btn btn-primary" name="format" value="csv"><Download size={16} /> CSV</button>
		<button class="btn" name="format" value="pdf"><Download size={16} /> PDFs (ZIP)</button>
	</form>
</section>

<style>
	.years {
		display: flex;
		gap: 0.25rem;
	}
	.years a {
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		font-weight: 650;
		color: var(--c-ink-2);
		text-decoration: none;
	}
	.years a[aria-current='page'] {
		background: var(--c-accent);
		color: var(--c-bg);
	}
	.kpis {
		display: grid;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	@media (min-width: 768px) {
		.kpis {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.kpis > div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.k-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--c-ink-3);
	}
	.k-val {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.block {
		margin-bottom: 1.25rem;
	}
	.grid {
		display: grid;
		gap: 1.25rem;
		margin-bottom: 1.25rem;
	}
	@media (min-width: 1100px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.num {
		text-align: right;
	}
	.bar-col {
		width: 30%;
	}
	.bar {
		display: block;
		height: 0.6rem;
		border-radius: 0 4px 4px 0;
		background: var(--c-accent);
		min-width: 2px;
	}
	.export {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
		margin-top: 1rem;
	}
</style>
