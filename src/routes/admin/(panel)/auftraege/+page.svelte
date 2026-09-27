<script lang="ts">
	import { badgeClass, DEKOR_STATUS_LABEL, DEKOR_TYPE_LABEL } from '$lib/admin-labels';
	import { relativeTime } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Dekor-Aufträge | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Dekor-Aufträge</h1>
		<p class="page-sub">Jeder bestellte Dekor ist ein Auftrag – vom Entwurf bis zum Versand.</p>
	</div>
	<a class="btn btn-ghost" href={data.showDone ? '/admin/auftraege' : '/admin/auftraege?alle'}>{data.showDone ? 'Nur aktuelle' : 'Auch ältere zeigen'}</a>
</div>

<div class="board">
	{#each data.columns as col (col.key)}
		<section class="col">
			<h2 class="col-title">{col.label} <span class="count">{col.jobs.length}</span></h2>
			<ul>
				{#each col.jobs as j (j.id)}
					<li>
						<a class="job card" href="/admin/auftraege/{j.id}">
							<span class="j-top">
								<span class="muted small">#{j.orderNumber} · {DEKOR_TYPE_LABEL[j.type]}</span>
								{#if j.dueDate}<span class="small due">bis {j.dueDate.split('-').reverse().join('.')}</span>{/if}
							</span>
							<strong>{j.title}</strong>
							<span class="small">{j.billing.firstName} {j.billing.lastName}</span>
							{#if j.bike}<span class="muted small">{j.bike.brand} {j.bike.model} {j.bike.year}</span>{/if}
							<span class="j-foot">
								<span class={badgeClass(DEKOR_STATUS_LABEL[j.status][1])}>{DEKOR_STATUS_LABEL[j.status][0]}</span>
								{#if j.paymentStatus !== 'bezahlt'}<span class="badge badge-red">nicht bezahlt</span>{/if}
								{#if j.revisions}<span class="badge">{j.revisions}× geändert</span>{/if}
							</span>
							<span class="muted small">{j.assignee ? `${j.assignee} · ` : ''}{relativeTime(j.updatedAt)}</span>
						</a>
					</li>
				{:else}
					<li class="empty-col">—</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.board {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(16rem, 1fr);
		gap: 1rem;
		overflow-x: auto;
		padding-bottom: 1rem;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
		padding: 0.75rem;
		border-radius: 12px;
		background: var(--c-surface-2);
	}
	.col-title {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		font-weight: 750;
		padding: 0 0.25rem;
	}
	.count {
		color: var(--c-ink-3);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.job {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.8rem 0.9rem;
		color: var(--c-ink);
		text-decoration: none;
	}
	.job:hover {
		border-color: var(--c-line-strong);
	}
	.j-top,
	.j-foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.35rem;
	}
	.j-foot {
		justify-content: flex-start;
		margin: 0.3rem 0 0.15rem;
	}
	.due {
		color: var(--c-warn);
		font-weight: 650;
	}
	.empty-col {
		padding: 0.5rem;
		color: var(--c-ink-3);
		text-align: center;
	}
</style>
