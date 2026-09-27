<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import LineConfig from '$lib/components/admin/LineConfig.svelte';
	import TeamFiles from '$lib/components/admin/TeamFiles.svelte';
	import { badgeClass, DEKOR_STATUS_LABEL, DEKOR_TYPE_LABEL, euro, euroInput, PAYMENT_STATUS_LABEL } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';
	import { submitting } from '$lib/formEnhance';
	import type { UploadedFile } from '$lib/shop-types';

	let { data } = $props();
	const j = $derived(data.job);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	let proofFiles = $state<UploadedFile[]>([]);
	const full = $derived(j.type === 'full_custom');
	const netNote = $derived(data.order.taxCase === 'reverse_charge' || data.order.taxCase === 'export');
	const PROOF: Record<string, [string, string]> = {
		offen: ['wartet auf Kunde', 'badge-warn'],
		freigegeben: ['freigegeben', 'badge-ok'],
		aenderung: ['Änderung gewünscht', 'badge-red'],
		ersetzt: ['ersetzt', '']
	};
	const nextStatuses: [string, string][] = [
		['in_gestaltung', 'In Gestaltung'],
		['in_produktion', 'In Produktion'],
		['versendet', 'Versendet'],
		['abgeschlossen', 'Abgeschlossen']
	];
</script>

<svelte:head><title>{j.title} | BYB Intern</title></svelte:head>

<a href="/admin/auftraege" class="back"><ArrowLeft size={16} /> Dekor-Aufträge</a>
<div class="page-head">
	<div>
		<h1 class="page-title">{j.title}</h1>
		<p class="page-sub">{DEKOR_TYPE_LABEL[j.type]} · <a href="/admin/bestellungen/{data.order.id}">Bestellung #{data.order.number}</a> · {data.order.billing.firstName} {data.order.billing.lastName}</p>
	</div>
	<span class={badgeClass(DEKOR_STATUS_LABEL[j.status][1])}>{DEKOR_STATUS_LABEL[j.status][0]}</span>
</div>

{#if data.order.paymentStatus !== 'bezahlt' && data.order.status !== 'storniert'}
	<p class="alert alert-warn">Die Bestellung ist noch nicht bezahlt{full ? ' (Anzahlung offen)' : ''}. Mit der Gestaltung erst nach Zahlungseingang beginnen.</p>
{/if}

<div class="layout">
	<div class="main">
		<section class="card card-pad">
			<h2 class="card-title">Angaben des Kunden</h2>
			{#if j.bike}<p class="bike"><strong>{j.bike.brand} {j.bike.model}</strong> · Baujahr {j.bike.year}</p>{/if}
			<LineConfig config={data.item.config} variantTitle={data.item.variantTitle} files={data.files} />
		</section>

		<section class="card card-pad">
			<h2 class="card-title">Entwurf senden</h2>
			<p class="card-sub">
				Der Kunde bekommt eine E-Mail und gibt den Entwurf online frei oder wünscht Änderungen.
				{#if full}Bisher {j.revisions} von {data.maxRevisions} Korrekturschleifen genutzt.{/if}
			</p>
			<form method="POST" action="?/entwurf" class="stack" use:enhance={submitting(setBusy, { onSuccess: () => (proofFiles = []) })}>
				<TeamFiles name="dateien" label="Entwurfsdateien" hint="Am besten JPG oder PNG – so sieht der Kunde eine Vorschau. PDF geht auch." bind:files={proofFiles} />
				<label class="field"><span class="label">Nachricht an den Kunden (optional)</span><textarea class="textarea" name="nachricht" rows="3" placeholder="Hier ist dein Entwurf – schau dir besonders die Startnummer an …"></textarea></label>
				<div><button class="btn btn-primary" disabled={busy || !proofFiles.length}>Entwurf senden</button></div>
			</form>
		</section>

		<section class="card card-pad">
			<h2 class="card-title">Entwürfe</h2>
			{#if data.proofs.length}
				<ul class="proofs">
					{#each data.proofs as p (p.id)}
						<li>
							<div class="p-head">
								<strong>Entwurf {p.version}</strong>
								<span class="badge {PROOF[p.status][1]}">{PROOF[p.status][0]}</span>
								<span class="muted small">{formatStamp(p.createdAt)}{p.decidedAt ? ` · beantwortet ${formatStamp(p.decidedAt)}` : ''}</span>
							</div>
							{#if p.message}<p class="pre small">{p.message}</p>{/if}
							<div class="p-files">
								{#each p.files as f (f.id)}
									<a href="/datei/{f.key}" target="_blank" rel="noopener">{#if f.preview}<img src="/datei/{f.key}?vorschau=1" alt={f.name} />{:else}<span class="doc"><FileText size={20} />{f.name}</span>{/if}</a>
								{/each}
							</div>
							{#if p.customerNote}<p class="pre note">Kunde: {p.customerNote}</p>{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">Noch kein Entwurf gesendet.</p>
			{/if}
		</section>
	</div>

	<aside class="side">
		{#if full}
			<section class="card card-pad">
				<h2 class="card-title">Endpreis & Restzahlung</h2>
				<p class="card-sub">Anzahlung {euro(j.depositAmount)}{netNote ? ' (netto)' : ''} wird abgezogen. Preise inkl. USt. eingeben{netNote ? ' – die Restzahlung wird automatisch netto berechnet' : ''}.</p>
				<form method="POST" action="?/preis" class="stack" use:enhance={submitting(setBusy)}>
					<div class="grid-2">
						<label class="field"><span class="label">Endpreis (€)</span><input class="input" name="endpreis" inputmode="decimal" required value={euroInput(j.finalPrice)} /></label>
						<label class="field"><span class="label">Versand (€)</span><input class="input" name="versand" inputmode="decimal" value={euroInput(j.shippingAmount ?? data.suggestedShipping)} /></label>
					</div>
					{#if data.preview != null}<p class="small">Restbetrag laut gespeichertem Preis: <strong>{euro(data.preview)}</strong></p>{/if}
					<div class="row">
						<button class="btn" name="anfordern" value="0" disabled={busy}>Nur speichern</button>
						<button class="btn btn-primary" name="anfordern" value="1" disabled={busy || !['freigegeben', 'restzahlung_offen'].includes(j.status)}>Restzahlung anfordern</button>
					</div>
					{#if !['freigegeben', 'restzahlung_offen'].includes(j.status)}<p class="muted small">Anfordern geht nach der Freigabe. Ist der Preis schon gespeichert, passiert es bei der Freigabe automatisch.</p>{/if}
				</form>
				{#if data.payments.length}
					<ul class="pays">
						{#each data.payments as p (p.id)}
							<li><span>{euro(p.amount)} · {p.method}</span><span class={badgeClass(PAYMENT_STATUS_LABEL[p.status][1])}>{PAYMENT_STATUS_LABEL[p.status][0]}</span></li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<section class="card card-pad">
			<h2 class="card-title">Status</h2>
			<form method="POST" action="?/status" class="status-btns" use:enhance={submitting(setBusy)}>
				{#each nextStatuses as [key, label] (key)}
					<button class="btn btn-sm" name="status" value={key} disabled={busy || j.status === key}>{label}</button>
				{/each}
			</form>
			<p class="muted small">„Versendet“ setzt sich automatisch, wenn die Bestellung versendet wird.</p>
		</section>

		<section class="card card-pad">
			<form method="POST" action="?/details" class="stack" use:enhance={submitting(setBusy)}>
				<label class="field">
					<span class="label">Zuständig</span>
					<select class="select" name="zustaendig" value={j.assigneeId ?? ''}>
						<option value="">–</option>
						{#each data.team as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
					</select>
				</label>
				<label class="field"><span class="label">Fertig bis</span><input class="input" type="date" name="termin" value={j.dueDate ?? ''} /></label>
				<label class="field"><span class="label">Interne Notiz</span><textarea class="textarea" name="notiz" rows="4">{j.internalNote}</textarea></label>
				<div><button class="btn btn-sm" disabled={busy}>Speichern</button></div>
			</form>
		</section>
	</aside>
</div>

<style>
	.alert {
		margin-bottom: 1.25rem;
	}
	.layout {
		display: grid;
		gap: 1.25rem;
	}
	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.main,
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.bike {
		margin-top: 0.5rem;
		font-size: 1.05rem;
	}
	.proofs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 0.75rem;
	}
	.proofs li {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--c-line);
	}
	.p-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.p-files {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin-top: 0.6rem;
	}
	.p-files img {
		width: 100%;
		border-radius: 8px;
		border: 1px solid var(--c-line);
	}
	.doc {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1rem 0.5rem;
		border: 1px solid var(--c-line);
		border-radius: 8px;
		font-size: 0.8rem;
		word-break: break-all;
		color: var(--c-ink-2);
	}
	.pre {
		white-space: pre-line;
	}
	.note {
		margin-top: 0.6rem;
		padding: 0.6rem 0.8rem;
		border-radius: 8px;
		background: var(--c-warn-soft);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pays {
		margin-top: 1rem;
	}
	.pays li {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-top: 1px solid var(--c-line);
	}
	.status-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.75rem 0 0.5rem;
	}
</style>
