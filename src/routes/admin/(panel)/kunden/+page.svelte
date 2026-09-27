<script lang="ts">
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import { euro } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';

	let { data } = $props();
	const href = (p: number) => `?${new URLSearchParams({ ...(data.q ? { q: data.q } : {}), ...(data.filter ? { filter: data.filter } : {}), ...(p > 1 ? { seite: String(p) } : {}) })}`;
</script>

<svelte:head><title>Kunden | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Kunden</h1>
		<p class="page-sub">Kundenkonten. Gastbestellungen ohne Konto stehen nur bei den Bestellungen.</p>
	</div>
</div>

<div class="toolbar">
	<nav class="filters">
		<a href="?" aria-current={!data.filter ? 'page' : undefined}>Alle</a>
		<a href="?filter=haendler" aria-current={data.filter === 'haendler' ? 'page' : undefined}>Händler</a>
		<a href="?filter=anfragen" aria-current={data.filter === 'anfragen' ? 'page' : undefined}>Händler-Anfragen</a>
	</nav>
	<form method="GET" class="grow">
		{#if data.filter}<input type="hidden" name="filter" value={data.filter} />{/if}
		<input class="input" type="search" name="q" value={data.q} placeholder="Name, E-Mail, Firma" aria-label="Suchen" />
	</form>
</div>

{#if data.rows.length}
	<div class="card table-wrap">
		<table class="table">
			<thead><tr><th>Kunde</th><th>Seit</th><th class="num">Bestellungen</th><th class="num">Umsatz</th><th></th></tr></thead>
			<tbody>
				{#each data.rows as c (c.id)}
					<tr>
						<td>
							<a class="row-link" href="/admin/kunden/{c.id}"><strong>{`${c.firstName} ${c.lastName}`.trim() || c.email}</strong></a>{#if c.company}<span class="muted small"> · {c.company}</span>{/if}<br />
							<span class="muted small">{c.email}</span>
						</td>
						<td class="muted small">{formatStamp(c.createdAt)}</td>
						<td class="num">{c.orders}</td>
						<td class="num tabular">{euro(c.revenue)}</td>
						<td>
							{#if c.dealerStatus === 'freigegeben'}<span class="badge badge-info">Händler</span>{:else if c.dealerStatus === 'angefragt'}<span class="badge badge-warn">Händler-Anfrage</span>{/if}
							{#if !c.verified}<span class="badge">nicht bestätigt</span>{/if}
							{#if !c.active}<span class="badge badge-red">gesperrt</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination page={data.page} pages={data.pages} {href} />
{:else}
	<p class="empty card card-pad">Keine Kunden gefunden.</p>
{/if}

<style>
	.filters {
		display: flex;
		gap: 0.25rem;
	}
	.filters a {
		padding: 0.45rem 0.8rem;
		border-radius: 8px;
		color: var(--c-ink-2);
		font-weight: 600;
		text-decoration: none;
	}
	.filters a[aria-current='page'] {
		background: var(--grad);
		color: #fff;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.num {
		text-align: right;
	}
</style>
