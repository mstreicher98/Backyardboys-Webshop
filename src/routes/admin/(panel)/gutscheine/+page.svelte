<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import { euro, euroInput } from '$lib/admin-labels';
	import { formatStamp } from '$lib/format';
	import { submitting } from '$lib/formEnhance';

	let { data } = $props();
	type Code = (typeof data.codes)[number];
	let newCard = $state(false);
	let adjust = $state<number | null>(null);
	let editCode = $state<Partial<Code> | null>(null);
	let codeKind = $state<'prozent' | 'betrag' | 'versandfrei'>('prozent');
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	function openCode(c: Partial<Code>) {
		editCode = { active: true, categoryIds: [], ...c };
		codeKind = (c.kind as typeof codeKind) ?? 'prozent';
	}
	const codeValue = (c: Code) => (c.kind === 'prozent' ? `${c.value} %` : c.kind === 'betrag' ? euro(c.value) : 'versandfrei');
</script>

<svelte:head><title>Gutscheine & Rabatte | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Gutscheine & Rabatte</h1>
		<p class="page-sub">Gutscheine sind Guthaben (Zahlungsmittel), Rabattcodes verringern den Preis.</p>
	</div>
</div>

<section class="card card-pad block">
	<div class="head">
		<h2 class="card-title">Rabattcodes</h2>
		<button type="button" class="btn btn-sm" onclick={() => openCode({})}><Plus size={15} /> Rabattcode</button>
	</div>
	{#if data.codes.length}
		<table class="table">
			<thead><tr><th>Code</th><th>Rabatt</th><th>Gültig</th><th class="num">Eingelöst</th><th></th></tr></thead>
			<tbody>
				{#each data.codes as c (c.id)}
					<tr class:off={!c.active}>
						<td><button type="button" class="linkish" onclick={() => openCode(c)}><strong>{c.code}</strong></button>{#if c.note}<br /><span class="muted small">{c.note}</span>{/if}</td>
						<td>{codeValue(c)}{c.minOrder ? ` ab ${euro(c.minOrder)}` : ''}</td>
						<td class="small">{c.validFrom ?? '…'} – {c.validUntil ?? '…'}</td>
						<td class="num">{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</td>
						<td>{#if !c.active}<span class="badge">aus</span>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="empty">Noch keine Rabattcodes.</p>
	{/if}
</section>

<section class="card card-pad block">
	<div class="head">
		<h2 class="card-title">Gutscheine</h2>
		<div class="row">
			<form method="GET"><input class="input sm" type="search" name="q" value={data.q} placeholder="Code oder E-Mail" aria-label="Suchen" /></form>
			<button type="button" class="btn btn-sm" onclick={() => (newCard = true)}><Plus size={15} /> Gutschein ausstellen</button>
		</div>
	</div>
	<p class="card-sub">Gekaufte Gutscheine entstehen automatisch bei Zahlungseingang und werden per E-Mail verschickt.</p>
	{#if data.cards.length}
		<table class="table">
			<thead><tr><th>Code</th><th class="num">Wert</th><th class="num">Guthaben</th><th>Für</th><th>Herkunft</th><th></th></tr></thead>
			<tbody>
				{#each data.cards as g (g.id)}
					<tr class:off={!g.active}>
						<td><strong class="mono">{g.code}</strong><br /><span class="muted small">{formatStamp(g.createdAt)}</span></td>
						<td class="num tabular">{euro(g.initialValue)}</td>
						<td class="num tabular"><strong>{euro(g.balance)}</strong></td>
						<td class="small">{g.recipientName} {g.recipientEmail}</td>
						<td class="small">{#if g.orderNumber}<a href="/admin/bestellungen/{g.orderId}">#{g.orderNumber}</a>{:else}{g.note || 'manuell'}{/if}</td>
						<td class="actions">
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => (adjust = adjust === g.id ? null : g.id)}>Guthaben</button>
							<form method="POST" action="?/aktiv" use:enhance={submitting(setBusy)}>
								<input type="hidden" name="id" value={g.id} /><input type="hidden" name="aktiv" value={g.active ? '0' : '1'} />
								<button class="btn btn-ghost btn-sm" disabled={busy}>{g.active ? 'Sperren' : 'Aktivieren'}</button>
							</form>
						</td>
					</tr>
					{#if adjust === g.id}
						<tr>
							<td colspan="6">
								<form method="POST" action="?/guthaben" class="adjust" use:enhance={submitting(setBusy, { onSuccess: () => (adjust = null) })}>
									<input type="hidden" name="id" value={g.id} />
									<input class="input sm" name="betrag" placeholder="+10,00 oder −5,00" inputmode="decimal" required aria-label="Betrag" />
									<input class="input" name="grund" placeholder="Grund (z. B. Kulanz)" aria-label="Grund" />
									<button class="btn btn-primary btn-sm" disabled={busy}>Buchen</button>
								</form>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="empty">Noch keine Gutscheine.</p>
	{/if}
</section>

{#if newCard}
	<div class="modal-bg" onclick={() => (newCard = false)} aria-hidden="true"></div>
	<form method="POST" action="?/gutschein" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (newCard = false) })}>
		<h2 class="card-title">Gutschein ausstellen</h2>
		<label class="field"><span class="label">Wert €</span><input class="input" name="wert" inputmode="decimal" required /></label>
		<div class="grid-2">
			<label class="field"><span class="label">Name Empfänger</span><input class="input" name="name" /></label>
			<label class="field"><span class="label">E-Mail Empfänger</span><input class="input" name="email" type="email" /></label>
		</div>
		<label class="field"><span class="label">Nachricht (steht in der Mail)</span><textarea class="textarea" name="nachricht" rows="2"></textarea></label>
		<label class="field"><span class="label">Interne Notiz</span><input class="input" name="notiz" placeholder="z. B. Gewinnspiel Instagram" /></label>
		<div class="grid-2">
			<label class="check"><input type="checkbox" name="senden" checked /><span>Per E-Mail senden</span></label>
			<label class="field"><span class="label">Sprache der Mail</span><select class="select" name="sprache"><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>
		</div>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Ausstellen</button><button type="button" class="btn btn-ghost" onclick={() => (newCard = false)}>Abbrechen</button></div>
	</form>
{/if}

{#if editCode}
	<div class="modal-bg" onclick={() => (editCode = null)} aria-hidden="true"></div>
	<form method="POST" action="?/code" class="modal card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => (editCode = null) })}>
		<h2 class="card-title">{editCode.id ? 'Rabattcode bearbeiten' : 'Neuer Rabattcode'}</h2>
		<input type="hidden" name="id" value={editCode.id ?? ''} />
		<div class="grid-2">
			<label class="field"><span class="label">Code</span><input class="input mono" name="code" required value={editCode.code ?? ''} placeholder="SOMMER10" /></label>
			<label class="field">
				<span class="label">Art</span>
				<select class="select" name="art" bind:value={codeKind}>
					<option value="prozent">Prozent</option>
					<option value="betrag">Fixer Betrag</option>
					<option value="versandfrei">Versandkostenfrei</option>
				</select>
			</label>
		</div>
		<div class="grid-2">
			{#if codeKind !== 'versandfrei'}
				<label class="field"><span class="label">{codeKind === 'prozent' ? 'Rabatt %' : 'Rabatt €'}</span><input class="input" name="wert" inputmode="decimal" required value={editCode.kind === 'betrag' ? euroInput(editCode.value) : (editCode.value ?? '')} /></label>
			{/if}
			<label class="field"><span class="label">Mindestbestellwert €</span><input class="input" name="mindest" inputmode="decimal" value={euroInput(editCode.minOrder)} /></label>
		</div>
		<div class="grid-2">
			<label class="field"><span class="label">Gültig ab</span><input class="input" type="date" name="ab" value={editCode.validFrom ?? ''} /></label>
			<label class="field"><span class="label">Gültig bis</span><input class="input" type="date" name="bis" value={editCode.validUntil ?? ''} /></label>
		</div>
		<label class="field"><span class="label">Höchstens so oft einlösbar <span class="opt">(leer = unbegrenzt)</span></span><input class="input" type="number" min="1" name="max" value={editCode.maxUses ?? ''} /></label>
		<fieldset class="field">
			<legend class="label">Nur für Kategorien <span class="opt">(nichts gewählt = alles)</span></legend>
			<div class="catlist">
				{#each data.categories as c (c.id)}
					<label class="check" class:sub={!!c.parentId}><input type="checkbox" name="kategorien" value={c.id} checked={editCode.categoryIds?.includes(c.id)} /><span>{c.name}</span></label>
				{/each}
			</div>
		</fieldset>
		<label class="check"><input type="checkbox" name="einmal" checked={editCode.oncePerCustomer} /><span>Nur einmal pro E-Mail-Adresse</span></label>
		<label class="check"><input type="checkbox" name="haendler" checked={editCode.dealersAllowed} /><span>Auch zusätzlich zu Händlerpreisen</span></label>
		<label class="check"><input type="checkbox" name="aktiv" checked={editCode.active} /><span>Aktiv</span></label>
		<label class="field"><span class="label">Notiz</span><input class="input" name="notiz" value={editCode.note ?? ''} /></label>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editCode = null)}>Abbrechen</button>
			<span class="spacer"></span>
			{#if editCode.id}<button class="btn btn-danger" formaction="?/code_loeschen" formnovalidate onclick={(e) => !confirm('Rabattcode löschen?') && e.preventDefault()}>Löschen</button>{/if}
		</div>
	</form>
{/if}

<style>
	.block {
		margin-bottom: 1.25rem;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.num {
		text-align: right;
	}
	.off {
		opacity: 0.55;
	}
	.mono {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}
	.actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}
	.adjust {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.input.sm {
		max-width: 12rem;
		height: 2.3rem;
	}
	.linkish {
		color: var(--c-ink);
		text-align: left;
	}
	.linkish:hover {
		text-decoration: underline;
	}
	.catlist {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-height: 12rem;
		overflow-y: auto;
		border: 0;
	}
	.catlist .sub {
		padding-left: 1.4rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
</style>
