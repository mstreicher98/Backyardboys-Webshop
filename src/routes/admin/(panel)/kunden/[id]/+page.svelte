<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { badgeClass, euro, ORDER_STATUS_LABEL } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';
	import { submitting } from '$lib/formEnhance';

	let { data } = $props();
	const c = $derived(data.customer);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
</script>

<svelte:head><title>{c.email} | BYB Intern</title></svelte:head>

<a href="/admin/kunden" class="back"><ArrowLeft size={16} /> Kunden</a>
<div class="page-head">
	<div>
		<h1 class="page-title">{`${c.firstName} ${c.lastName}`.trim() || c.email}</h1>
		<p class="page-sub">{c.email} · Konto seit {formatStamp(c.createdAt)}{c.lastLoginAt ? ` · zuletzt angemeldet ${formatStamp(c.lastLoginAt)}` : ''}</p>
	</div>
	<div class="badges">
		{#if !c.emailVerifiedAt}<span class="badge">E-Mail nicht bestätigt</span>{/if}
		{#if !c.active}<span class="badge badge-red">gesperrt</span>{/if}
	</div>
</div>

<div class="layout">
	<div class="main">
		{#if c.dealerStatus === 'angefragt'}
			<section class="card card-pad attention">
				<h2 class="card-title">Händler-Anfrage</h2>
				<p>{c.company} · UID {c.vatId} – {c.vatIdValid === true ? 'laut VIES gültig' : c.vatIdValid === false ? 'laut VIES NICHT gültig' : 'noch nicht geprüft'}</p>
				{#if c.internalNote}<p class="pre muted small">{c.internalNote}</p>{/if}
				<form method="POST" action="?/haendler" class="row" use:enhance={submitting(setBusy)}>
					<button class="btn btn-primary" name="entscheidung" value="freigeben" disabled={busy}>Freischalten</button>
					<button class="btn" name="entscheidung" value="ablehnen" disabled={busy}>Ablehnen</button>
				</form>
			</section>
		{/if}

		<section class="card card-pad">
			<h2 class="card-title">Bestellungen</h2>
			{#if data.orders.length}
				<table class="table">
					<tbody>
						{#each data.orders as o (o.id)}
							<tr>
								<td><a href="/admin/bestellungen/{o.id}"><strong>#{o.number}</strong></a></td>
								<td class="muted small">{formatStamp(o.createdAt)}</td>
								<td class="tabular">{euro(o.total)}</td>
								<td><span class={badgeClass(ORDER_STATUS_LABEL[o.status][1])}>{ORDER_STATUS_LABEL[o.status][0]}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="muted">Noch keine Bestellungen mit diesem Konto.</p>
			{/if}
		</section>

		{#if data.addresses.length}
			<section class="card card-pad">
				<h2 class="card-title">Adressen</h2>
				<div class="addr">
					{#each data.addresses as a (a.id)}
						<address>{#if a.company}{a.company}<br />{/if}{a.firstName} {a.lastName}<br />{a.street}<br />{a.zip} {a.city}, {a.country}{#if a.isDefault}<br /><span class="badge">Standard</span>{/if}</address>
					{/each}
				</div>
			</section>
		{/if}
	</div>

	<aside class="side">
		<form method="POST" action="?/speichern" class="card card-pad stack" use:enhance={submitting(setBusy)}>
			<h2 class="card-title">Daten</h2>
			<div class="grid-2">
				<label class="field"><span class="label">Vorname</span><input class="input" name="vorname" value={c.firstName} /></label>
				<label class="field"><span class="label">Nachname</span><input class="input" name="nachname" value={c.lastName} /></label>
			</div>
			<label class="field"><span class="label">Telefon</span><input class="input" name="telefon" value={c.phone} /></label>
			<label class="field"><span class="label">Firma</span><input class="input" name="firma" value={c.company} /></label>
			<label class="field">
				<span class="label">UID-Nummer</span>
				<input class="input" name="uid" value={c.vatId} />
				{#if c.vatId}<span class="hint">{c.vatIdValid === true ? `gültig (geprüft ${formatStamp(c.vatIdCheckedAt)})` : c.vatIdValid === false ? 'laut VIES ungültig' : 'nicht geprüft'}</span>{/if}
			</label>
			{#if c.dealerStatus === 'freigegeben'}
				<label class="field"><span class="label">Händlerrabatt % <span class="opt">(leer = Standard {data.defaultDiscount} %)</span></span><input class="input" type="number" min="0" max="90" name="rabatt" value={c.dealerDiscount ?? ''} /></label>
			{/if}
			<label class="field"><span class="label">Interne Notiz</span><textarea class="textarea" name="notiz" rows="3">{c.internalNote}</textarea></label>
			<label class="check"><input type="checkbox" name="aktiv" checked={c.active} /><span>Konto aktiv (abwählen = sperren)</span></label>
			<div class="row">
				<button class="btn btn-primary" disabled={busy}>Speichern</button>
				{#if c.vatId}<button class="btn" formaction="?/uid" disabled={busy}>UID prüfen</button>{/if}
			</div>
		</form>

		<section class="card card-pad stack">
			<h2 class="card-title">Händler</h2>
			<p class="small">Status: <strong>{c.dealerStatus === 'freigegeben' ? 'Händler' : c.dealerStatus === 'angefragt' ? 'angefragt' : c.dealerStatus === 'abgelehnt' ? 'abgelehnt' : 'kein Händler'}</strong></p>
			<form method="POST" action="?/haendler" class="row" use:enhance={submitting(setBusy)}>
				{#if c.dealerStatus !== 'freigegeben'}<button class="btn btn-sm" name="entscheidung" value="freigeben" disabled={busy}>Als Händler freischalten</button>{/if}
				{#if c.dealerStatus === 'freigegeben'}<button class="btn btn-sm" name="entscheidung" value="kein" disabled={busy}>Händlerstatus entfernen</button>{/if}
			</form>
		</section>

		<form method="POST" action="?/loeschen" class="card card-pad stack" use:enhance>
			<h2 class="card-title">Konto löschen</h2>
			<p class="muted small">Bestellungen und Rechnungen bleiben wegen der Aufbewahrungspflicht erhalten, das Konto und die Adressen werden gelöscht.</p>
			<div><button class="btn btn-danger btn-sm" onclick={(e) => !confirm('Kundenkonto endgültig löschen?') && e.preventDefault()}>Konto löschen</button></div>
		</form>
	</aside>
</div>

<style>
	.badges {
		display: flex;
		gap: 0.4rem;
	}
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.main,
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.attention {
		border-left: 4px solid var(--c-warn);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.pre {
		white-space: pre-line;
	}
	.addr {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 1rem;
		margin-top: 0.75rem;
	}
	address {
		font-style: normal;
	}
</style>
