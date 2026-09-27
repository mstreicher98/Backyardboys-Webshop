<script lang="ts">
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Palette from '@lucide/svelte/icons/palette';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import { badgeClass, euro, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';

	let { data } = $props();
	const tabs = [
		['alle', 'Alle'],
		['offen', 'Zu erledigen'],
		['zahlung', 'Zahlung offen'],
		['versendet', 'Versendet'],
		['storniert', 'Storniert']
	];
	const href = (p: number) => {
		const u = new URLSearchParams();
		if (data.filter !== 'alle') u.set('filter', data.filter);
		if (data.q) u.set('q', data.q);
		if (p > 1) u.set('seite', String(p));
		return `?${u}`;
	};
</script>

<svelte:head><title>Bestellungen | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Bestellungen</h1>
	</div>
</div>

<div class="toolbar">
	<nav class="segmented" aria-label="Filter">
		{#each tabs as [key, label] (key)}
			<a href="?filter={key}{data.q ? `&q=${encodeURIComponent(data.q)}` : ''}" class="seg" aria-current={data.filter === key ? 'page' : undefined}>{label}</a>
		{/each}
	</nav>
	<form method="GET" class="grow">
		{#if data.filter !== 'alle'}<input type="hidden" name="filter" value={data.filter} />{/if}
		<input class="input" type="search" name="q" value={data.q} placeholder="Nummer, Name, E-Mail, Firma" aria-label="Suchen" />
	</form>
</div>

{#if data.rows.length}
	<div class="card table-wrap">
		<table class="table">
			<thead>
				<tr><th>Nr.</th><th>Datum</th><th>Kunde</th><th class="num">Artikel</th><th class="num">Summe</th><th>Zahlung</th><th>Status</th></tr>
			</thead>
			<tbody>
				{#each data.rows as o (o.id)}
					<tr>
						<td>
							<a href="/admin/bestellungen/{o.id}" class="row-link"><strong>#{o.number}</strong></a>
							{#if o.dekor}<span title="Dekor-Auftrag" class="ic"><Palette size={14} /></span>{/if}
							{#if o.unread}<span title="Neue Nachricht" class="ic warn"><MessageSquare size={14} /></span>{/if}
						</td>
						<td class="muted small">{formatStamp(o.createdAt)}</td>
						<td>{o.billing.firstName} {o.billing.lastName}{#if o.billing.company}<span class="muted small"> · {o.billing.company}</span>{/if}<br /><span class="muted small">{o.email}</span></td>
						<td class="num">{o.items}</td>
						<td class="num tabular">{euro(o.total)}</td>
						<td><span class={badgeClass(PAYMENT_STATUS_LABEL[o.paymentStatus][1])}>{PAYMENT_STATUS_LABEL[o.paymentStatus][0]}</span><br /><span class="muted small">{o.paymentMethod}</span></td>
						<td><span class={badgeClass(ORDER_STATUS_LABEL[o.status][1])}>{ORDER_STATUS_LABEL[o.status][0]}</span></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination page={data.page} pages={data.pages} {href} />
{:else}
	<p class="empty card card-pad">{data.q ? 'Keine Bestellung gefunden.' : 'Hier erscheinen die Bestellungen aus dem Shop.'}</p>
{/if}

<style>
	.seg {
		display: inline-flex;
		align-items: center;
		height: 2.3rem;
		padding: 0 0.8rem;
		border-radius: 7px;
		color: var(--c-ink-2);
		font-weight: 600;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.seg[aria-current='page'] {
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-1);
	}
	.table-wrap {
		overflow-x: auto;
	}
	.num {
		text-align: right;
	}
	.ic {
		display: inline-flex;
		vertical-align: middle;
		margin-left: 0.3rem;
		color: var(--c-ink-3);
	}
	.ic.warn {
		color: var(--c-warn);
	}
</style>
