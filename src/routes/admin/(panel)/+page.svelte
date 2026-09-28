<script lang="ts">
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import ViewsChart from '$lib/components/admin/ViewsChart.svelte';
	import { badgeClass, DEKOR_STATUS_LABEL, DEKOR_TYPE_LABEL, euro, ORDER_STATUS_LABEL } from '$lib/admin-labels';
	import { formatStamp, formatNumber } from '$lib/format';

	let { data } = $props();
	const totalViews = $derived(data.views.reduce((a, v) => a + v.n, 0));
	const keep = () => async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update({ reset: false });
</script>

<svelte:head><title>Übersicht | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Übersicht</h1>
		<p class="page-sub">Was heute ansteht.</p>
	</div>
	<a class="btn btn-primary" href="/admin/produkte/neu">Neues Produkt</a>
</div>

{#if data.setup.length}
	<section class="card card-pad setup" class:all-done={data.setupAllDone}>
		<div class="setup-head">
			<div>
				<h2 class="card-title">Vor dem Start</h2>
				<p class="card-sub">
					{data.setupAllDone
						? 'Alles erledigt – der Shop kann öffentlich werden.'
						: data.canEditSetup
							? 'Diese Punkte sollten erledigt sein, bevor der Shop öffentlich wird. Erledigtes zum Abhaken anklicken.'
							: 'Diese Punkte sollten erledigt sein, bevor der Shop öffentlich wird.'}
				</p>
			</div>
			{#if data.setupAllDone && data.canEditSetup}
				<form method="POST" action="?/setup" use:enhance={keep}>
					<button class="btn btn-sm" name="ausblenden" value="1">Checkliste ausblenden</button>
				</form>
			{/if}
		</div>
		<form method="POST" action="?/setup" use:enhance={keep}>
			<ul>
				{#each data.setup as s (s.key)}
					<li class:done={s.done}>
						{#if s.auto}
							<span class="tick on auto" title="Vom System erkannt"><Check size={13} strokeWidth={3} /></span>
						{:else}
							<button
								class="tick"
								class:on={s.done}
								name="punkt"
								value={s.key}
								aria-pressed={s.done}
								aria-label={s.done ? `„${s.label}“ wieder öffnen` : `„${s.label}“ als erledigt abhaken`}
								title={s.done ? 'Wieder öffnen' : 'Als erledigt abhaken'}
								disabled={!data.canEditSetup}
							>
								{#if s.done}<Check size={13} strokeWidth={3} />{/if}
							</button>
						{/if}
						<a href={s.href}>{s.label}</a>
						{#if s.auto}<span class="how">automatisch erkannt</span>{/if}
					</li>
				{/each}
			</ul>
		</form>
	</section>
{/if}

{#if data.finance}
	<div class="kpis">
		<div class="card card-pad kpi"><span class="k-label">Zahlungseingang heute</span><span class="k-val tabular">{euro(data.finance.today)}</span></div>
		<div class="card card-pad kpi"><span class="k-label">Zahlungseingang diesen Monat</span><span class="k-val tabular">{euro(data.finance.month)}</span></div>
		<div class="card card-pad kpi"><span class="k-label">Bestellungen diesen Monat</span><span class="k-val tabular">{formatNumber(data.finance.monthOrders)}</span></div>
	</div>
{/if}

<div class="grid">
	<section class="card card-pad">
		<div class="sec-head">
			<h2 class="card-title">Dekor-Aufträge</h2>
			<a class="small" href="/admin/auftraege">Board öffnen</a>
		</div>
		{#if data.jobs.length}
			<ul class="list">
				{#each data.jobs as j (j.id)}
					<li>
						<a href="/admin/auftraege/{j.id}" class="row-link">
							<span><strong>{j.title}</strong><span class="muted small"> · {DEKOR_TYPE_LABEL[j.type]} · #{j.orderNumber}</span></span>
							<span class={badgeClass(DEKOR_STATUS_LABEL[j.status][1])}>{DEKOR_STATUS_LABEL[j.status][0]}</span>
						</a>
						{#if j.paymentStatus !== 'bezahlt'}<span class="muted small">Zahlung noch offen</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Keine offenen Aufträge.</p>
		{/if}
	</section>

	<section class="card card-pad">
		<div class="sec-head">
			<h2 class="card-title">Offene Überweisungen</h2>
		</div>
		{#if data.transfers.length}
			<ul class="list">
				{#each data.transfers as t (t.id)}
					<li>
						<a href="/admin/bestellungen/{t.id}" class="row-link">
							<span><strong>#{t.number}</strong> {t.billing.firstName} {t.billing.lastName}</span>
							<span class="tabular">{euro(t.amountDue)}</span>
						</a>
						<span class="small" class:overdue={t.overdue}>seit {t.days} {t.days === 1 ? 'Tag' : 'Tagen'}{t.overdue ? ' – überfällig' : ''}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Keine offenen Überweisungen.</p>
		{/if}
	</section>

	<section class="card card-pad">
		<div class="sec-head">
			<h2 class="card-title">Neueste Bestellungen</h2>
			<a class="small" href="/admin/bestellungen">Alle</a>
		</div>
		{#if data.recent.length}
			<ul class="list">
				{#each data.recent as o (o.id)}
					<li>
						<a href="/admin/bestellungen/{o.id}" class="row-link">
							<span><strong>#{o.number}</strong> {o.billing.firstName} {o.billing.lastName} <span class="muted small">· {formatStamp(o.createdAt)}</span></span>
							<span class={badgeClass(ORDER_STATUS_LABEL[o.status][1])}>{ORDER_STATUS_LABEL[o.status][0]}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Noch keine Bestellungen.</p>
		{/if}
	</section>

	<section class="card card-pad">
		<h2 class="card-title">Braucht Aufmerksamkeit</h2>
		<ul class="list">
			{#each data.unread as u (u.orderId)}
				<li><a href="/admin/bestellungen/{u.orderId}" class="row-link"><span>Neue Nachricht zu <strong>#{u.number}</strong></span><span class="badge badge-warn">{u.n}</span></a></li>
			{/each}
			{#each data.lowStock as l (l.productId + l.values.join())}
				<li><a href="/admin/produkte/{l.productId}" class="row-link"><span>Wenig Bestand: <strong>{l.title}</strong> {l.values.join(' / ')}</span><span class="badge {l.stock <= 0 ? 'badge-red' : 'badge-warn'}">{l.stock}</span></a></li>
			{/each}
			{#if data.drafts}
				<li><a href="/admin/produkte?status=entwurf" class="row-link"><span>{data.drafts} {data.drafts === 1 ? 'Produkt ist' : 'Produkte sind'} noch Entwurf</span></a></li>
			{/if}
		</ul>
		{#if !data.unread.length && !data.lowStock.length && !data.drafts}<p class="empty">Alles erledigt.</p>{/if}
	</section>
</div>

<section class="card card-pad views">
	<div class="sec-head">
		<h2 class="card-title">Besucher (30 Tage)</h2>
		<span class="muted small">{formatNumber(totalViews)} Seitenaufrufe · gezählt ohne Cookies</span>
	</div>
	<ViewsChart data={data.views} />
</section>

<style>
	.setup {
		margin-bottom: 1.25rem;
		border-left: 4px solid var(--c-warn);
	}
	.setup.all-done {
		border-left-color: var(--c-ok);
	}
	.setup-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.setup ul {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-top: 0.9rem;
	}
	.setup li {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-height: 2rem;
		color: var(--c-ink-2);
	}
	.setup li.done a {
		text-decoration: line-through;
		color: var(--c-ink-3);
	}
	.setup a {
		color: inherit;
	}
	.how {
		font-size: 0.78rem;
		color: var(--c-ink-3);
	}
	/* Haken: leerer Kreis, abgehakt im Akzentverlauf */
	.tick {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		border: 1.5px solid var(--c-line-strong);
		background: var(--c-surface);
		color: #fff;
		transition:
			border-color 150ms,
			transform 150ms var(--ease-out);
	}
	button.tick:hover:not(:disabled) {
		border-color: var(--c-accent);
		transform: scale(1.08);
	}
	button.tick:disabled {
		cursor: default;
	}
	.tick.on {
		border-color: transparent;
		background: var(--grad);
		animation: tick-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.tick.auto {
		background: var(--c-ok);
		animation: none;
	}
	@keyframes tick-pop {
		from {
			transform: scale(0.6);
		}
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
	.kpi {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.k-label {
		font-size: 0.85rem;
		color: var(--c-ink-3);
		font-weight: 600;
	}
	.k-val {
		font-size: 1.7rem;
		font-weight: 800;
		font-stretch: 105%;
	}
	.grid {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1100px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.sec-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}
	.sec-head a {
		color: var(--c-ink-2);
	}
	.list {
		display: flex;
		flex-direction: column;
		margin-top: 0.75rem;
	}
	.list li {
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--c-line);
	}
	.list li:last-child {
		border-bottom: 0;
	}
	.row-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		color: var(--c-ink);
		text-decoration: none;
	}
	.row-link:hover strong {
		text-decoration: underline;
	}
	.overdue {
		color: var(--c-danger);
		font-weight: 650;
	}
	.views {
		margin-top: 1.25rem;
	}
</style>
