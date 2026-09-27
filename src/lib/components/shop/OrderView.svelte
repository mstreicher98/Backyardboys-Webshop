<script lang="ts">
	import { enhance } from '$app/forms';
	import FileText from '@lucide/svelte/icons/file-text';
	import FileField from './FileField.svelte';
	import LineDetails from './LineDetails.svelte';
	import { getI18n } from '$lib/i18n.svelte';
	import type { UploadedFile } from '$lib/shop-types';
	import type { customerOrderView } from '$lib/server/shop/order-view';

	type View = Awaited<ReturnType<typeof customerOrderView>>;
	let { v, form, paymentError = null }: { v: View; form: { ok?: string; error?: string } | null | undefined; paymentError?: string | null } = $props();
	const i = getI18n();
	const o = $derived(v.order);

	const STATUS: Record<string, [string, string]> = {
		zahlung_offen: ['Zahlung offen', 'Awaiting payment'],
		in_bearbeitung: ['In Bearbeitung', 'Processing'],
		abholbereit: ['Abholbereit', 'Ready for pickup'],
		versendet: ['Versendet', 'Shipped'],
		abgeschlossen: ['Abgeschlossen', 'Completed'],
		storniert: ['Storniert', 'Cancelled']
	};
	const statusLabel = (s: string) => i.tr(...(STATUS[s] ?? [s, s]));
	const steps = $derived.by(() => {
		const last = o.shippingMethod === 'abholung' ? ['abholbereit', i.tr('Abholbereit', 'Ready for pickup')] : ['versendet', i.tr('Versendet', 'Shipped')];
		return [
			['bestellt', i.tr('Bestellt', 'Ordered')],
			['bezahlt', i.tr('Bezahlt', 'Paid')],
			['in_bearbeitung', i.tr('In Arbeit', 'In progress')],
			last
		] as [string, string][];
	});
	const reached = $derived(
		o.status === 'storniert' ? -1 : o.status === 'abgeschlossen' || o.status === 'versendet' || o.status === 'abholbereit' ? 3 : o.paymentStatus === 'bezahlt' ? 2 : 0
	);
	const KIND: Record<string, [string, string]> = {
		rechnung: ['Rechnung', 'Invoice'],
		anzahlung: ['Anzahlungsrechnung', 'Deposit invoice'],
		schluss: ['Schlussrechnung', 'Final invoice'],
		storno: ['Stornorechnung', 'Credit note']
	};

	let busy = $state(false);
	let msgFiles = $state<UploadedFile[]>([]);
	const done = () => {
		busy = true;
		return async ({ update, result }: { update: (o?: { reset?: boolean }) => Promise<void>; result: { type: string } }) => {
			await update({ reset: result.type === 'success' });
			if (result.type === 'success') msgFiles = [];
			busy = false;
		};
	};
</script>

<div class="head">
	<div>
		<h1 class="display h1">{i.tr('Bestellung', 'Order')} {o.number}</h1>
		<p class="muted">{i.tr('vom', 'from')} {i.date(o.createdAt)} · {o.email}</p>
	</div>
	<span class="badge" class:badge-dark={o.status === 'storniert'}>{statusLabel(o.status)}</span>
</div>

{#if o.status !== 'storniert'}
	<ol class="progress" aria-label={i.tr('Fortschritt', 'Progress')}>
		{#each steps as [key, label], n (key)}
			<li class:done={n <= reached} aria-current={n === reached ? 'step' : undefined}>{label}</li>
		{/each}
	</ol>
{/if}

{#if form?.ok}<p class="alert alert-ok" role="status">{form.ok}</p>{/if}
{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
{#if paymentError}
	<p class="alert alert-error">
		{paymentError === 'einrichtung'
			? i.tr('Die Online-Zahlung ist gerade nicht verfügbar. Bitte wähle unten eine andere Zahlungsart oder melde dich bei uns.', 'Online payment is currently unavailable. Please choose another method below or contact us.')
			: i.tr('Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.', 'The payment could not be started. Please try again.')}
	</p>
{/if}

{#if v.openPayment && o.status !== 'storniert'}
	<section class="pay panel">
		<div>
			<h2 class="h3">{v.openPayment.purpose === 'restzahlung' ? i.tr('Restzahlung offen', 'Remaining payment due') : i.tr('Zahlung offen', 'Payment due')}</h2>
			<p class="amount tabular">{i.money(v.openPayment.amount)}</p>
			{#if v.bank && v.openPayment.method === 'ueberweisung'}
				<dl class="bank">
					<div><dt>{i.tr('Empfänger', 'Recipient')}</dt><dd>{v.bank.name}</dd></div>
					<div><dt>IBAN</dt><dd>{v.bank.iban || i.tr('folgt per E-Mail', 'follows by email')}</dd></div>
					{#if v.bank.bic}<div><dt>BIC</dt><dd>{v.bank.bic}</dd></div>{/if}
					<div><dt>{i.tr('Verwendungszweck', 'Reference')}</dt><dd>{i.tr('Bestellung', 'Order')} {o.number}</dd></div>
				</dl>
				<p class="muted small">{i.tr(`Bitte innerhalb von ${v.bank.days} Tagen überweisen.`, `Please transfer within ${v.bank.days} days.`)}</p>
			{/if}
		</div>
		{#if v.openPayment.method !== 'ueberweisung' && v.openPayment.method !== 'bar'}
			<a class="btn" href={i.href(`/zahlung/${v.openPayment.token}`)}>{i.tr('Jetzt bezahlen', 'Pay now')}</a>
		{:else}
			<a class="link small" href={i.href(`/zahlung/${v.openPayment.token}`)}>{i.tr('Andere Zahlungsart wählen', 'Choose another payment method')}</a>
		{/if}
	</section>
{/if}

{#each v.jobs as job (job.id)}
	{@const open = job.proofs.find((p) => p.status === 'offen')}
	<section class="job">
		<div class="job-head">
			<h2 class="h3">{job.title}</h2>
			<span class="badge badge-outline">{job.statusLabel}</span>
		</div>
		{#if open}
			<div class="proof">
				<p class="h3 small-h">{i.tr(`Entwurf ${open.version}`, `Design ${open.version}`)}</p>
				{#if open.message}<p class="pre">{open.message}</p>{/if}
				<div class="proof-files">
					{#each open.files as f (f.id)}
						<a href="/datei/{f.key}" target="_blank" rel="noopener" class="pf">
							{#if f.preview}<img src="/datei/{f.key}?vorschau=1" alt={f.name} loading="lazy" />{:else}<span class="doc"><FileText size={28} />{f.name}</span>{/if}
						</a>
					{/each}
				</div>
				<div class="decide">
					<form method="POST" use:enhance={done}>
						<input type="hidden" name="aktion" value="freigeben" />
						<input type="hidden" name="auftrag" value={job.id} />
						<input type="hidden" name="entwurf" value={open.id} />
						<p class="muted small">{i.tr('Bitte prüfe Schreibweisen, Nummern und Farben genau – mit der Freigabe geht das Design so in den Druck.', 'Please check spelling, numbers and colours carefully – once approved, the design goes to print as shown.')}</p>
						<button class="btn" aria-busy={busy} disabled={busy}>{i.tr('Entwurf freigeben', 'Approve design')}</button>
					</form>
					<form method="POST" use:enhance={done} class="change">
						<input type="hidden" name="aktion" value="aendern" />
						<input type="hidden" name="auftrag" value={job.id} />
						<input type="hidden" name="entwurf" value={open.id} />
						<label class="field">
							<span class="label">{i.tr('Oder: Was sollen wir ändern?', 'Or: what should we change?')}</span>
							<textarea class="textarea" name="notiz" maxlength="4000" required></textarea>
						</label>
						{#if job.type === 'full_custom'}
							<p class="muted small">{i.tr(`Korrekturschleife ${Math.min(job.revisions + 1, v.maxRevisions)} von ${v.maxRevisions} inklusive.`, `Revision ${Math.min(job.revisions + 1, v.maxRevisions)} of ${v.maxRevisions} included.`)}</p>
						{/if}
						<button class="btn btn-ghost" aria-busy={busy} disabled={busy}>{i.tr('Änderung anfragen', 'Request changes')}</button>
					</form>
				</div>
			</div>
		{:else if job.status === 'neu' || job.status === 'in_gestaltung' || job.status === 'aenderung_gewuenscht'}
			<p class="muted">{i.tr('Wir arbeiten an deinem Entwurf und melden uns per E-Mail, sobald er fertig ist.', "We're working on your design and will email you as soon as it's ready.")}</p>
		{/if}
		{#if job.proofs.some((p) => p.status !== 'offen')}
			<details class="history">
				<summary>{i.tr('Frühere Entwürfe', 'Earlier designs')}</summary>
				<ul>
					{#each job.proofs.filter((p) => p.status !== 'offen') as p (p.id)}
						<li>
							<strong>{i.tr(`Entwurf ${p.version}`, `Design ${p.version}`)}</strong>
							<span class="muted small">{p.status === 'freigegeben' ? i.tr('freigegeben', 'approved') : p.status === 'aenderung' ? i.tr('Änderung gewünscht', 'changes requested') : i.tr('ersetzt', 'replaced')}</span>
							<span class="proof-files small-files">
								{#each p.files as f (f.id)}<a href="/datei/{f.key}" target="_blank" rel="noopener">{#if f.preview}<img src="/datei/{f.key}?vorschau=1" alt={f.name} loading="lazy" />{:else}{f.name}{/if}</a>{/each}
							</span>
							{#if p.customerNote}<span class="pre small">{p.customerNote}</span>{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</section>
{/each}

<div class="cols">
	<section>
		<h2 class="h3">{i.tr('Artikel', 'Items')}</h2>
		<ul class="items">
			{#each v.items as it (it.id)}
				<li>
					<div>
						<strong>{it.quantity}× {it.title}</strong>
						<LineDetails config={it.config} variantTitle={it.variantTitle} isDeposit={it.isDeposit} files={v.files} />
					</div>
					<span class="tabular">{i.money(it.lineTotal)}</span>
				</li>
			{/each}
		</ul>
		<dl class="sums tabular">
			<div><dt>{i.tr('Zwischensumme', 'Subtotal')}</dt><dd>{i.money(o.subtotal)}</dd></div>
			{#if o.discountTotal}<div><dt>{i.tr('Rabatt', 'Discount')} {o.discountCode ?? ''}</dt><dd>−{i.money(o.discountTotal)}</dd></div>{/if}
			{#if o.shippingMethod !== 'keiner' && v.items.some((it) => !it.isDeposit && it.kind !== 'gutschein')}<div><dt>{o.shippingMethod === 'abholung' ? i.tr('Abholung', 'Pickup') : i.tr('Versand', 'Shipping')}</dt><dd>{i.money(o.shippingTotal)}</dd></div>{/if}
			<div class="total"><dt>{i.tr('Summe', 'Total')}</dt><dd>{i.money(o.total)}</dd></div>
			{#if o.taxTotal}<div class="note"><dt>{i.tr('darin USt.', 'incl. VAT')}</dt><dd>{i.money(o.taxTotal)}</dd></div>{/if}
			{#if o.giftCardTotal}<div><dt>{i.tr('Gutschein', 'Gift card')}</dt><dd>−{i.money(o.giftCardTotal)}</dd></div>{/if}
		</dl>
	</section>

	<section class="side">
		<div>
			<h2 class="h3">{i.tr('Rechnungsadresse', 'Billing address')}</h2>
			<address>
				{#if o.billing.company}{o.billing.company}<br />{/if}{o.billing.firstName} {o.billing.lastName}<br />{o.billing.street}<br />{o.billing.zip} {o.billing.city}, {o.billing.country}
			</address>
		</div>
		<div>
			<h2 class="h3">{i.tr('Lieferung', 'Delivery')}</h2>
			{#if o.shippingMethod === 'abholung'}
				<p>{i.tr('Abholung', 'Pickup')}</p>
			{:else if o.shippingMethod === 'keiner'}
				<p class="muted">{i.tr('Kein Versand nötig', 'No shipping needed')}</p>
			{:else if o.shipping}
				<address>{#if o.shipping.company}{o.shipping.company}<br />{/if}{o.shipping.firstName} {o.shipping.lastName}<br />{o.shipping.street}<br />{o.shipping.zip} {o.shipping.city}, {o.shipping.country}</address>
			{/if}
			{#if o.trackingNumber}
				<p class="small">
					{o.trackingCarrier ? `${o.trackingCarrier}: ` : ''}{#if o.trackingUrl}<a class="link" href={o.trackingUrl} target="_blank" rel="noopener noreferrer">{o.trackingNumber}</a>{:else}{o.trackingNumber}{/if}
				</p>
			{/if}
		</div>
		<div>
			<h2 class="h3">{i.tr('Zahlung', 'Payment')}</h2>
			<p>{o.paymentLabel} · {o.paymentStatus === 'bezahlt' ? i.tr('bezahlt', 'paid') : o.paymentStatus === 'erstattet' ? i.tr('erstattet', 'refunded') : i.tr('offen', 'open')}</p>
		</div>
		{#if v.invoices.length}
			<div>
				<h2 class="h3">{i.tr('Rechnungen', 'Invoices')}</h2>
				<ul class="invoices">
					{#each v.invoices as inv (inv.id)}
						<li><a class="link" href="/bestellung/{o.token}/rechnung/{inv.id}" target="_blank">{i.tr(...KIND[inv.kind])} {inv.number}</a> <span class="muted small">{i.money(inv.total)}</span></li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>
</div>

<section class="messages">
	<h2 class="h3">{i.tr('Nachrichten', 'Messages')}</h2>
	{#if v.messages.length}
		<ul class="thread">
			{#each v.messages as m (m.id)}
				<li class:team={m.author === 'team'} class:system={m.author === 'system'}>
					<span class="who small">{m.author === 'team' ? 'Backyardboys Design' : m.author === 'system' ? i.tr('Hinweis', 'Note') : i.tr('Du', 'You')} · {i.dateTime(m.createdAt)}</span>
					<p class="pre">{m.body}</p>
					{#if m.files.length}
						<span class="proof-files small-files">
							{#each m.files as f (f.id)}<a href="/datei/{f.key}" target="_blank" rel="noopener">{#if f.preview}<img src="/datei/{f.key}?vorschau=1" alt={f.name} loading="lazy" />{:else}{f.name}{/if}</a>{/each}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted small">{i.tr('Fragen zur Bestellung? Schreib uns hier – wir antworten per E-Mail.', 'Questions about your order? Write to us here – we reply by email.')}</p>
	{/if}
	{#if o.status !== 'storniert'}
		<form method="POST" use:enhance={done} class="msg-form">
			<input type="hidden" name="aktion" value="nachricht" />
			<label class="field">
				<span class="sr-only">{i.tr('Nachricht', 'Message')}</span>
				<textarea class="textarea" name="text" maxlength="4000" required placeholder={i.tr('Deine Nachricht …', 'Your message …')}></textarea>
			</label>
			<FileField name="dateien" label={i.tr('Dateien anhängen (optional)', 'Attach files (optional)')} max={5} bind:files={msgFiles} />
			<button class="btn btn-ghost" aria-busy={busy} disabled={busy}>{i.tr('Nachricht senden', 'Send message')}</button>
		</form>
	{/if}
</section>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}
	.progress {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.35rem;
		margin: 1.75rem 0;
		counter-reset: s;
	}
	.progress li {
		counter-increment: s;
		padding-top: 0.6rem;
		border-top: 3px solid #27272a;
		font-size: 0.8rem;
		font-weight: 650;
		color: #71717a;
	}
	.progress li.done {
		border-image: var(--grad) 1;
		color: #d4d4d8;
	}
	/* Aktueller Schritt: Verlauf mit durchlaufendem Lichtpunkt – hier passiert gerade etwas */
	.progress li[aria-current='step'] {
		position: relative;
		border-image: var(--grad) 1;
		color: #fff;
	}
	.progress li[aria-current='step']::before {
		content: '';
		position: absolute;
		top: -3px;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.85), transparent) no-repeat;
		background-size: 35% 100%;
		animation: shimmer 2.4s var(--ease-out) infinite;
	}
	@keyframes shimmer {
		from {
			background-position: -60% 0;
		}
		to {
			background-position: 160% 0;
		}
	}
	.alert {
		margin-bottom: 1.25rem;
	}
	.pay {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 2rem;
		border-left: 3px solid #fff;
	}
	.amount {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.bank {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.75rem 0;
		font-size: 0.95rem;
	}
	.bank div {
		display: flex;
		gap: 0.75rem;
	}
	.bank dt {
		min-width: 9rem;
		color: #a1a1aa;
	}
	.job {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background: #0f0f11;
		box-shadow: inset 0 0 0 1px #27272a;
	}
	.job-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.small-h {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}
	.proof-files {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}
	.pf img {
		width: 100%;
		background: #fff;
		display: block;
	}
	.doc {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 0.75rem;
		background: #18181b;
		color: #d4d4d8;
		font-size: 0.85rem;
		text-align: center;
		word-break: break-all;
	}
	.small-files {
		grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr));
		margin: 0.5rem 0;
	}
	.small-files img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
	}
	.small-files a {
		color: #d4d4d8;
		font-size: 0.8rem;
		word-break: break-all;
	}
	.decide {
		display: grid;
		gap: 1.5rem;
		margin-top: 1.25rem;
	}
	@media (min-width: 900px) {
		.decide {
			grid-template-columns: 1fr 1fr;
		}
	}
	.decide form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.change .field {
		width: 100%;
	}
	.history {
		margin-top: 1.25rem;
	}
	.history summary {
		cursor: pointer;
		font-weight: 650;
	}
	.history li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid #27272a;
	}
	.pre {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.cols {
		display: grid;
		gap: 2rem;
		margin-top: 1rem;
	}
	@media (min-width: 1024px) {
		.cols {
			grid-template-columns: 1.6fr 1fr;
		}
	}
	.items li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 0;
		border-bottom: 1px solid #27272a;
	}
	.sums {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 1rem;
	}
	.sums div {
		display: flex;
		justify-content: space-between;
	}
	.sums .total {
		font-weight: 800;
		font-size: 1.1rem;
		padding-top: 0.5rem;
		border-top: 1px solid #3f3f46;
	}
	.sums .note {
		font-size: 0.85rem;
		color: #a1a1aa;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.side .h3 {
		margin-bottom: 0.4rem;
		font-size: 0.95rem;
	}
	address {
		font-style: normal;
		color: #d4d4d8;
	}
	.messages {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid #27272a;
		max-width: 52rem;
	}
	.thread {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1rem 0 1.5rem;
	}
	.thread li {
		padding: 0.9rem 1rem;
		background: #18181b;
		margin-right: 3rem;
	}
	.thread li.team {
		background: var(--grad);
		color: #fff;
		margin: 0 0 0 3rem;
	}
	.thread li.team .who {
		color: rgb(255 255 255 / 0.78);
	}
	.thread li.system {
		background: transparent;
		box-shadow: inset 0 0 0 1px #27272a;
	}
	.who {
		display: block;
		color: #a1a1aa;
		margin-bottom: 0.25rem;
	}
	.msg-form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		align-items: flex-start;
		margin-top: 1rem;
	}
	.msg-form .field {
		width: 100%;
	}
	.msg-form :global(.field) {
		width: 100%;
	}
</style>
