<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import LineConfig from '$lib/components/admin/LineConfig.svelte';
	import TeamFiles from '$lib/components/admin/TeamFiles.svelte';
	import { badgeClass, DEKOR_STATUS_LABEL, DEKOR_TYPE_LABEL, euro, INVOICE_KIND_LABEL, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, TAX_CASE_LABEL } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';
	import { submitting } from '$lib/formEnhance';
	import type { UploadedFile } from '$lib/shop-types';

	let { data } = $props();
	const o = $derived(data.order);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	let msgFiles = $state<UploadedFile[]>([]);
	let showCancel = $state(false);
	let carrier = $state('post');
	const openPayments = $derived(data.payments.filter((p) => p.status === 'offen'));
	const physical = $derived(o.shippingMethod !== 'keiner');
	const addr = (a: typeof o.billingAddress) => [a.company, `${a.firstName} ${a.lastName}`, a.street, `${a.zip} ${a.city}`, a.country].filter(Boolean);
</script>

<svelte:head><title>Bestellung #{o.number} | BYB Intern</title></svelte:head>

<a href="/admin/bestellungen" class="back"><ArrowLeft size={16} /> Bestellungen</a>
<div class="page-head">
	<div>
		<h1 class="page-title">Bestellung #{o.number}</h1>
		<p class="page-sub">
			{formatStamp(o.createdAt)} · {o.locale === 'en' ? 'Englisch' : 'Deutsch'}{o.isDealer ? ' · Händler' : ''}
		</p>
	</div>
	<div class="head-badges">
		<span class={badgeClass(ORDER_STATUS_LABEL[o.status][1])}>{ORDER_STATUS_LABEL[o.status][0]}</span>
		<span class={badgeClass(PAYMENT_STATUS_LABEL[o.paymentStatus][1])}>Zahlung {PAYMENT_STATUS_LABEL[o.paymentStatus][0]}</span>
	</div>
</div>

<div class="layout">
	<div class="main">
		<!-- Nächster Schritt -->
		{#if o.status !== 'storniert'}
			<section class="card card-pad next">
				<h2 class="card-title">Nächster Schritt</h2>
				{#if openPayments.length}
					{#each openPayments as p (p.id)}
						<form method="POST" action="?/bezahlt" use:enhance={submitting(setBusy)} class="row">
							<input type="hidden" name="zahlung" value={p.id} />
							<span>{p.purpose === 'restzahlung' ? 'Restzahlung' : 'Zahlung'} über <strong>{euro(p.amount)}</strong> per {p.method} offen</span>
							<button class="btn btn-primary btn-sm" disabled={busy}>Zahlung erhalten</button>
						</form>
					{/each}
					<p class="muted small">Online-Zahlungen (Stripe, PayPal) werden automatisch verbucht. Überweisungen hier bestätigen, sobald sie am Konto sind.</p>
				{/if}
				{#if o.paymentStatus === 'bezahlt' && (o.status === 'in_bearbeitung' || o.status === 'abholbereit')}
					{#if o.shippingMethod === 'versand'}
						<form method="POST" action="?/versendet" use:enhance={submitting(setBusy)} class="ship">
							<div class="grid-3">
								<label class="field">
									<span class="label">Versanddienst</span>
									<select class="select" name="versanddienst" bind:value={carrier}>
										{#each data.carriers as c (c.key)}<option value={c.key}>{c.label}</option>{/each}
									</select>
								</label>
								<label class="field"><span class="label">Sendungsnummer</span><input class="input" name="sendungsnummer" /></label>
								{#if carrier === 'andere'}<label class="field"><span class="label">Link zur Verfolgung</span><input class="input" name="link" type="url" /></label>{/if}
							</div>
							<label class="check"><input type="checkbox" name="mail" checked /><span>Kunde per E-Mail informieren</span></label>
							<div><button class="btn btn-primary" disabled={busy}>Als versendet markieren</button></div>
						</form>
					{:else if o.shippingMethod === 'abholung' && o.status !== 'abholbereit'}
						<form method="POST" action="?/abholbereit" use:enhance={submitting(setBusy)} class="row">
							<label class="check"><input type="checkbox" name="mail" checked /><span>Kunde informieren</span></label>
							<button class="btn btn-primary btn-sm" disabled={busy}>Abholbereit</button>
						</form>
					{/if}
					{#if o.shippingMethod !== 'versand'}
						<form method="POST" action="?/status" use:enhance={submitting(setBusy)} class="row">
							<input type="hidden" name="status" value="abgeschlossen" />
							<span class="muted small">{o.shippingMethod === 'abholung' ? 'Abgeholt?' : 'Digital geliefert?'}</span>
							<button class="btn btn-sm" disabled={busy}>Abschließen</button>
						</form>
					{/if}
				{:else if o.status === 'versendet'}
					<form method="POST" action="?/status" use:enhance={submitting(setBusy)} class="row">
						<input type="hidden" name="status" value="abgeschlossen" />
						<span>Versendet am {formatStamp(o.shippedAt)}{o.trackingNumber ? ` · ${o.trackingCarrier} ${o.trackingNumber}` : ''}</span>
						<button class="btn btn-sm" disabled={busy}>Abschließen</button>
					</form>
				{:else if o.status === 'abgeschlossen'}
					<p class="muted">Abgeschlossen.</p>
				{/if}
				{#if data.jobs.some((j) => !['versendet', 'abgeschlossen', 'storniert', 'in_produktion'].includes(j.status)) && o.paymentStatus === 'bezahlt'}
					<p class="alert alert-info">Diese Bestellung enthält Dekor-Aufträge, die noch nicht in Produktion sind – siehe unten.</p>
				{/if}
			</section>
		{/if}

		<!-- Artikel -->
		<section class="card card-pad">
			<h2 class="card-title">Artikel</h2>
			<ul class="items">
				{#each data.items as it (it.id)}
					<li>
						<div class="it-head">
							<span>
								<strong>{it.quantity}× {it.title}</strong>
								{#if it.isDeposit}<span class="badge badge-warn">Anzahlung</span>{/if}
								{#if it.sku}<span class="muted small"> · {it.sku}</span>{/if}
							</span>
							<span class="tabular">{euro(it.lineTotal)}</span>
						</div>
						<LineConfig config={it.config} variantTitle={it.variantTitle} files={data.files} />
					</li>
				{/each}
			</ul>
			<dl class="sums tabular">
				<div><dt>Zwischensumme</dt><dd>{euro(o.subtotal)}</dd></div>
				{#if o.discountTotal}<div><dt>Rabatt {o.discountCode ?? ''}</dt><dd>−{euro(o.discountTotal)}</dd></div>{/if}
				{#if physical && data.items.some((it) => !it.isDeposit && it.kind !== 'gutschein')}<div><dt>{o.shippingMethod === 'abholung' ? 'Abholung' : `Versand ${o.shippingCountry ?? ''}`}</dt><dd>{euro(o.shippingTotal)}</dd></div>{/if}
				<div class="total"><dt>Summe</dt><dd>{euro(o.total)}</dd></div>
				<div class="note"><dt>Steuer: {TAX_CASE_LABEL[o.taxCase]}{o.taxCase === 'normal' ? ` ${o.taxRate / 100} %` : ''}</dt><dd>{euro(o.taxTotal)}</dd></div>
				{#if o.giftCardTotal}<div><dt>mit Gutschein bezahlt</dt><dd>−{euro(o.giftCardTotal)}</dd></div>{/if}
			</dl>
		</section>

		{#if data.jobs.length}
			<section class="card card-pad">
				<h2 class="card-title">Dekor-Aufträge</h2>
				<ul class="list">
					{#each data.jobs as j (j.id)}
						<li>
							<a href="/admin/auftraege/{j.id}" class="row-link">
								<span><strong>{j.title}</strong> <span class="muted small">· {DEKOR_TYPE_LABEL[j.type]}{j.proofs.length ? ` · ${j.proofs.length} Entwürfe` : ''}</span></span>
								<span class={badgeClass(DEKOR_STATUS_LABEL[j.status][1])}>{DEKOR_STATUS_LABEL[j.status][0]}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Nachrichten -->
		<section class="card card-pad">
			<h2 class="card-title">Nachrichten</h2>
			{#if data.messages.length}
				<ul class="thread">
					{#each data.messages as m (m.id)}
						<li class={m.author}>
							<span class="who small">{m.author === 'team' ? 'Team' : m.author === 'system' ? 'System' : 'Kunde'} · {formatStamp(m.createdAt)}</span>
							<p class="pre">{m.body}</p>
							{#if m.fileIds.length}
								<span class="mfiles">
									{#each m.fileIds as id (id)}{#if data.files[id]}<a href="/datei/{data.files[id].key}?download=1">{data.files[id].name}</a>{/if}{/each}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted small">Noch keine Nachrichten.</p>
			{/if}
			<form method="POST" action="?/nachricht" class="stack" use:enhance={submitting(setBusy, { onSuccess: () => (msgFiles = []) })}>
				<label class="field"><span class="label">Antwort an den Kunden</span><textarea class="textarea" name="text" rows="4" required></textarea></label>
				<TeamFiles name="dateien" label="Anhänge (optional)" max={5} bind:files={msgFiles} />
				<label class="check"><input type="checkbox" name="mail" checked /><span>Per E-Mail benachrichtigen</span></label>
				<div><button class="btn" disabled={busy}>Senden</button></div>
			</form>
		</section>
	</div>

	<aside class="side">
		<section class="card card-pad">
			<h2 class="card-title">Kunde</h2>
			<p>
				{#if data.customer}<a href="/admin/kunden/{data.customer.id}">{data.customer.name || o.email}</a>{#if data.customer.dealer} <span class="badge badge-info">Händler</span>{/if}{:else}Gast{/if}
			</p>
			<p><a href="mailto:{o.email}">{o.email}</a>{#if o.phone}<br /><a href="tel:{o.phone}">{o.phone}</a>{/if}</p>
			{#if o.vatId}<p class="small">UID: {o.vatId}</p>{/if}
			<h3 class="sub">Rechnungsadresse</h3>
			<address>{#each addr(o.billingAddress) as l (l)}{l}<br />{/each}</address>
			{#if o.shippingAddress}
				<h3 class="sub">Lieferadresse</h3>
				<address>{#each addr(o.shippingAddress) as l (l)}{l}<br />{/each}</address>
			{:else if o.shippingMethod === 'abholung'}
				<p class="badge badge-info">Abholung</p>
			{/if}
			{#if o.customerNote}
				<h3 class="sub">Anmerkung des Kunden</h3>
				<p class="pre note-box">{o.customerNote}</p>
			{/if}
			<a class="small ext" href="/admin/zum-shop?pfad=/bestellung/{o.token}" target="_blank" rel="noopener"><ExternalLink size={14} /> Kundenansicht</a>
		</section>

		<section class="card card-pad">
			<h2 class="card-title">Zahlung</h2>
			<p class="small">{data.paymentLabel}</p>
			<ul class="list">
				{#each data.payments as p (p.id)}
					<li class="row-link">
						<span>{p.purpose === 'restzahlung' ? 'Restzahlung' : 'Bestellung'} · {p.method}<br /><span class="muted small">{p.paidAt ? formatStamp(p.paidAt) : formatStamp(p.createdAt)}</span></span>
						<span class="tabular">{euro(p.amount)} <span class={badgeClass(PAYMENT_STATUS_LABEL[p.status][1])}>{PAYMENT_STATUS_LABEL[p.status][0]}</span></span>
					</li>
				{/each}
			</ul>
			{#if o.status === 'storniert' && o.paymentStatus === 'bezahlt'}
				<form method="POST" action="?/erstattet" use:enhance={submitting(setBusy)}>
					<p class="alert alert-warn">Storniert, aber bezahlt – bitte erstatten (bei Stripe/PayPal im jeweiligen Dashboard).</p>
					<button class="btn btn-sm" disabled={busy}>Als erstattet markieren</button>
				</form>
			{/if}
		</section>

		<section class="card card-pad">
			<h2 class="card-title">Rechnungen</h2>
			{#if data.invoices.length}
				<ul class="list">
					{#each data.invoices as inv (inv.id)}
						<li class="row-link"><a href="/admin/rechnungen/{inv.id}" target="_blank">{INVOICE_KIND_LABEL[inv.kind]} {inv.number}</a><span class="tabular">{euro(inv.total)}</span></li>
					{/each}
				</ul>
			{:else if o.paymentStatus === 'bezahlt'}
				<form method="POST" action="?/rechnung" use:enhance={submitting(setBusy)}><button class="btn btn-sm" disabled={busy}>Rechnung erstellen</button></form>
			{:else}
				<p class="muted small">Entsteht automatisch bei Zahlungseingang.</p>
			{/if}
		</section>

		<section class="card card-pad">
			<form method="POST" action="?/notiz" class="stack" use:enhance={submitting(setBusy)}>
				<label class="field"><span class="label">Interne Notiz</span><textarea class="textarea" name="notiz" rows="3">{o.internalNote}</textarea></label>
				<div><button class="btn btn-sm" disabled={busy}>Notiz speichern</button></div>
			</form>
		</section>

		<section class="card card-pad">
			<h2 class="card-title">E-Mails</h2>
			{#if data.mails.length}
				<ul class="list mails">
					{#each data.mails as m (m.id)}
						<li><span class="small">{m.subject}</span><span class="muted small">{formatStamp(m.createdAt)} · {m.status === 'gesendet' ? 'gesendet' : m.status === 'fehler' ? `Fehler: ${m.error}` : 'SMTP nicht eingerichtet'}</span></li>
					{/each}
				</ul>
			{/if}
			<form method="POST" action="?/bestaetigung" use:enhance={submitting(setBusy)}><button class="btn btn-ghost btn-sm" disabled={busy}>Bestellbestätigung erneut senden</button></form>
		</section>

		{#if o.status !== 'storniert' && o.status !== 'abgeschlossen'}
			<section class="card card-pad danger">
				{#if showCancel}
					<form method="POST" action="?/stornieren" class="stack" use:enhance={submitting(setBusy, { onSuccess: () => (showCancel = false) })}>
						<label class="field"><span class="label">Grund (steht in der Mail an den Kunden)</span><textarea class="textarea" name="grund" rows="2"></textarea></label>
						<label class="check"><input type="checkbox" name="mail" checked /><span>Kunde informieren</span></label>
						<p class="muted small">Lagerbestand und Gutscheine werden zurückgebucht, Rechnungen storniert.</p>
						<div class="row"><button class="btn btn-danger" disabled={busy}>Endgültig stornieren</button><button type="button" class="btn btn-ghost" onclick={() => (showCancel = false)}>Abbrechen</button></div>
					</form>
				{:else}
					<button type="button" class="btn btn-danger btn-sm" onclick={() => (showCancel = true)}>Bestellung stornieren</button>
				{/if}
			</section>
		{/if}
	</aside>
</div>

<style>
	.head-badges {
		display: flex;
		gap: 0.4rem;
	}
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.main,
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.next {
		border-left: 4px solid var(--c-accent);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.ship {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.grid-3 {
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 768px) {
		.grid-3 {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.items li {
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--c-line);
	}
	.it-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.sums {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.75rem;
	}
	.sums div {
		display: flex;
		justify-content: space-between;
	}
	.sums .total {
		font-weight: 800;
		padding-top: 0.4rem;
		border-top: 1px solid var(--c-line);
	}
	.sums .note {
		font-size: 0.85rem;
		color: var(--c-ink-3);
	}
	.list {
		display: flex;
		flex-direction: column;
		margin-top: 0.5rem;
	}
	.list li {
		padding: 0.5rem 0;
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
	.thread {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0.75rem 0 1.25rem;
	}
	.thread li {
		padding: 0.7rem 0.9rem;
		border-radius: 10px;
		background: var(--c-surface-2);
		margin-right: 2.5rem;
	}
	.thread li.team {
		background: var(--c-accent-soft);
		margin: 0 0 0 2.5rem;
	}
	.who {
		display: block;
		color: var(--c-ink-3);
	}
	.pre {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.mfiles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		font-size: 0.85rem;
		margin-top: 0.3rem;
	}
	.sub {
		margin: 1rem 0 0.25rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--c-ink-3);
	}
	address {
		font-style: normal;
	}
	.note-box {
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		background: var(--c-warn-soft);
	}
	.ext {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 1rem;
		color: var(--c-ink-2);
	}
	.mails li {
		display: flex;
		flex-direction: column;
	}
	.danger {
		border-color: color-mix(in srgb, var(--c-danger) 35%, var(--c-line));
	}
</style>
