<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Download from '@lucide/svelte/icons/download';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import BackupRestore from '$lib/components/admin/BackupRestore.svelte';
	import PasswordInput from '$lib/components/admin/PasswordInput.svelte';
	import { formatBytes, formatStamp } from '$lib/format';
	import { submitting } from '$lib/formEnhance';

	let { data } = $props();
	const s = $derived(data.settings);
	const c = $derived(data.settings.company);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
	let restore = $state<BackupRestore>();

	const TABS = [
		['firma', 'Firma'],
		['steuer', 'Steuer & Rechnungen'],
		['zahlung', 'Zahlung'],
		['versand', 'Versand'],
		['email', 'E-Mail'],
		['haendler', 'Händler & Dekore'],
		['sicherung', 'Sicherungen']
	] as const;
	const tab = $derived(page.url.searchParams.get('tab') ?? 'firma');
	let taxMode = $state<'kleinunternehmer' | 'regel'>('kleinunternehmer');
	$effect.pre(() => {
		taxMode = data.settings.tax.mode;
	});
	let filter = $state('');
</script>

<svelte:head><title>Einstellungen | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Einstellungen</h1>
	</div>
</div>

<nav class="tabs" aria-label="Bereiche">
	{#each TABS as [key, label] (key)}
		<a href="?tab={key}" aria-current={tab === key ? 'page' : undefined} onclick={(e) => (e.preventDefault(), goto(`?tab=${key}`, { replaceState: true, noScroll: true }))}>{label}</a>
	{/each}
</nav>

{#if tab === 'firma'}
	<form method="POST" action="?/firma" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		{#if data.gaps.length}<p class="alert alert-warn">Für Rechnungen und Impressum fehlt noch: {data.gaps.join(', ')}.</p>{/if}
		<div class="grid-2">
			<label class="field"><span class="label">Firmenwortlaut <span class="opt">(laut Firmenbuch)</span></span><input class="input" name="name" value={c.name} /></label>
			<label class="field"><span class="label">Markenname im Shop</span><input class="input" name="marke" value={c.brand} /></label>
		</div>
		<div class="grid-3">
			<label class="field"><span class="label">Straße</span><input class="input" name="strasse" value={c.street} /></label>
			<label class="field"><span class="label">PLZ</span><input class="input" name="plz" value={c.zip} /></label>
			<label class="field"><span class="label">Ort</span><input class="input" name="ort" value={c.city} /></label>
		</div>
		<label class="field"><span class="label">Land</span><input class="input" name="land" value={c.country} /></label>
		<div class="grid-3">
			<label class="field"><span class="label">E-Mail</span><input class="input" name="email" type="email" value={c.email} /></label>
			<label class="field"><span class="label">Telefon</span><input class="input" name="telefon" value={c.phone} /></label>
			<label class="field"><span class="label">WhatsApp</span><input class="input" name="whatsapp" value={c.whatsapp} /></label>
		</div>
		<h2 class="card-title sub">Firmenbuch & Gewerbe <span class="opt">(Impressum, Rechnungen)</span></h2>
		<div class="grid-3">
			<label class="field"><span class="label">Firmenbuchnummer</span><input class="input" name="fn" value={c.fn} placeholder="FN 123456a" /></label>
			<label class="field"><span class="label">Firmenbuchgericht</span><input class="input" name="gericht" value={c.court} placeholder="z. B. Landesgericht Korneuburg" /></label>
			<label class="field"><span class="label">UID-Nummer</span><input class="input" name="uid" value={c.uid} placeholder="ATU12345678" /></label>
		</div>
		<label class="field"><span class="label">Vertretungsbefugte Gesellschafter</span><input class="input" name="vertretung" value={c.representatives} /></label>
		<div class="grid-3">
			<label class="field"><span class="label">Kammer</span><input class="input" name="kammer" value={c.chamber} /></label>
			<label class="field"><span class="label">Gewerbe</span><input class="input" name="gewerbe" value={c.trade} placeholder="z. B. Werbegrafik-Designer" /></label>
			<label class="field"><span class="label">Gewerbebehörde</span><input class="input" name="behoerde" value={c.authority} placeholder="z. B. BH Bruck an der Leitha" /></label>
		</div>
		<h2 class="card-title sub">Bank <span class="opt">(Überweisung, Rechnungen)</span></h2>
		<div class="grid-3">
			<label class="field"><span class="label">IBAN</span><input class="input" name="iban" value={c.iban} /></label>
			<label class="field"><span class="label">BIC</span><input class="input" name="bic" value={c.bic} /></label>
			<label class="field"><span class="label">Bank</span><input class="input" name="bank" value={c.bank} /></label>
		</div>
		<h2 class="card-title sub">Social Media</h2>
		<div class="grid-2">
			<label class="field"><span class="label">Instagram</span><input class="input" name="instagram" value={c.instagram} placeholder="https://www.instagram.com/…" /></label>
			<label class="field"><span class="label">Facebook</span><input class="input" name="facebook" value={c.facebook} /></label>
			<label class="field"><span class="label">TikTok</span><input class="input" name="tiktok" value={c.tiktok} /></label>
			<label class="field"><span class="label">YouTube</span><input class="input" name="youtube" value={c.youtube} /></label>
		</div>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>
{:else if tab === 'steuer'}
	<form method="POST" action="?/steuer" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<fieldset class="field">
			<legend class="label">Umsatzsteuer</legend>
			<div class="segmented">
				<label><input type="radio" name="modus" value="kleinunternehmer" bind:group={taxMode} /><span>Kleinunternehmer (keine USt.)</span></label>
				<label><input type="radio" name="modus" value="regel" bind:group={taxMode} /><span>Regelbesteuerung</span></label>
			</div>
		</fieldset>
		{#if taxMode === 'regel'}
			<div class="grid-2">
				<label class="field"><span class="label">Normalsteuersatz %</span><input class="input" name="satz" value={(s.tax.standardRate / 100).toString().replace('.', ',')} /></label>
				<label class="check oss"><input type="checkbox" name="oss" checked={s.tax.oss} /><span>OSS aktiv – Privatkunden in anderen EU-Ländern zahlen deren Steuersatz (Sätze unter „Versand“)</span></label>
			</div>
			<p class="hint">Firmen mit gültiger UID in anderen EU-Ländern: automatisch Reverse Charge (netto). Lieferungen außerhalb der EU: netto als Ausfuhrlieferung. Preise im Shop bleiben immer inkl. österreichischer USt.</p>
		{:else}
			<input type="hidden" name="satz" value={s.tax.standardRate / 100} />
			<p class="hint">Rechnungen tragen den Hinweis „Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG“.</p>
		{/if}
		<h2 class="card-title sub">Rechnungen & Zahlungsfristen</h2>
		<div class="grid-3">
			<label class="field"><span class="label">Präfix Rechnungsnummer</span><input class="input" name="praefix" value={s.orders.invoicePrefix} /><span class="hint">Ergibt {s.orders.invoicePrefix ? `${s.orders.invoicePrefix}-` : ''}{new Date().getFullYear()}-0001</span></label>
			<label class="field"><span class="label">Zahlungsziel Überweisung (Tage)</span><input class="input" type="number" name="tage" value={s.orders.transferDays} /></label>
			<label class="field"><span class="label">Abgebrochene Online-Zahlung stornieren nach (Stunden)</span><input class="input" type="number" name="storno_stunden" value={s.orders.autoCancelHours} /></label>
		</div>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>
{:else if tab === 'zahlung'}
	<form method="POST" action="?/zahlung" class="stack" use:enhance={submitting(setBusy)}>
		<section class="card card-pad stack">
			<label class="check big"><input type="checkbox" name="stripe" checked={s.payments.stripe.enabled} /><span><strong>Stripe</strong> – Karte, Apple/Google Pay, EPS, Klarna, SEPA</span></label>
			<p class="hint">
				Welche Zahlungsarten Kunden sehen, stellst du im Stripe-Dashboard unter <em>Einstellungen → Zahlungsmethoden</em> ein. Schlüssel unter <em>Entwickler → API-Schlüssel</em>. Webhook unter
				<em>Entwickler → Webhooks</em> anlegen mit der Adresse <code>{data.webhookUrl}</code> und den Ereignissen <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>,
				<code>checkout.session.async_payment_failed</code>, <code>checkout.session.expired</code>.
			</p>
			<div class="grid-2">
				<label class="field">
					<span class="label">Geheimer Schlüssel {#if data.secrets.stripeSecretKey}<span class="opt">(hinterlegt: {data.secrets.stripeSecretKey})</span>{/if}</span>
					<PasswordInput name="stripe_key" autocomplete="off" placeholder={data.secrets.stripeSecretKey ? 'leer lassen = unverändert' : 'sk_live_…'} />
				</label>
				<label class="field">
					<span class="label">Webhook-Signing-Secret {#if data.secrets.stripeWebhookSecret}<span class="opt">(hinterlegt: {data.secrets.stripeWebhookSecret})</span>{/if}</span>
					<PasswordInput name="stripe_webhook" autocomplete="off" placeholder={data.secrets.stripeWebhookSecret ? 'leer lassen = unverändert' : 'whsec_…'} />
				</label>
			</div>
			{#if data.secrets.stripeSecretKey}<div><button class="btn btn-sm" formaction="?/stripe_test" formnovalidate disabled={busy}>Verbindung testen</button></div>{/if}
		</section>
		<section class="card card-pad stack">
			<label class="check big"><input type="checkbox" name="paypal" checked={s.payments.paypal.enabled} /><span><strong>PayPal</strong></span></label>
			<p class="hint">Zugangsdaten unter developer.paypal.com → Apps & Credentials (Live oder Sandbox).</p>
			<div class="grid-2">
				<label class="field"><span class="label">Client-ID {#if data.secrets.paypalClientId}<span class="opt">(hinterlegt)</span>{/if}</span><PasswordInput name="paypal_id" autocomplete="off" placeholder={data.secrets.paypalClientId ? 'leer lassen = unverändert' : ''} /></label>
				<label class="field"><span class="label">Secret {#if data.secrets.paypalSecret}<span class="opt">(hinterlegt)</span>{/if}</span><PasswordInput name="paypal_secret" autocomplete="off" placeholder={data.secrets.paypalSecret ? 'leer lassen = unverändert' : ''} /></label>
			</div>
			<label class="check"><input type="checkbox" name="paypal_sandbox" checked={s.payments.paypal.sandbox} /><span>Sandbox (Testmodus)</span></label>
		</section>
		<section class="card card-pad stack">
			<label class="check big"><input type="checkbox" name="ueberweisung" checked={s.payments.transfer.enabled} /><span><strong>Überweisung (Vorkasse)</strong> – Bankverbindung aus „Firma“</span></label>
			<label class="check big"><input type="checkbox" name="bar" checked={s.payments.cash.enabled} /><span><strong>Barzahlung bei Abholung</strong></span></label>
			<p class="hint">Bar- und Kartenzahlung vor Ort kann die Registrierkassenpflicht auslösen (ab 15.000 € Jahresumsatz, davon über 7.500 € bar). Bitte mit dem Steuerberater klären.</p>
		</section>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>
{:else if tab === 'versand'}
	<form method="POST" action="?/versand" class="stack" use:enhance={submitting(setBusy)}>
		<section class="card card-pad stack">
			<div class="head">
				<div>
					<h2 class="card-title">Versandländer</h2>
					<p class="card-sub">Pauschale je Land inkl. USt. „Frei ab“ = versandkostenfrei ab diesem Warenwert. USt.-Satz nur für OSS.</p>
				</div>
				<input class="input sm" bind:value={filter} placeholder="Land suchen" aria-label="Land suchen" />
			</div>
			<table class="table">
				<thead><tr><th>Land</th><th>Aktiv</th><th>Versand €</th><th>Frei ab €</th><th>USt. %</th></tr></thead>
				<tbody>
					{#each data.countries as k (k.code)}
						<tr class:hidden={filter && !k.name.toLowerCase().includes(filter.toLowerCase())}>
							<td><input type="hidden" name="code" value={k.code} />{k.name} <span class="muted small">{k.code}{k.eu ? '' : ' · außerhalb EU'}</span></td>
							<td><input type="checkbox" name="aktiv_{k.code}" checked={k.active} aria-label="{k.name} aktiv" /></td>
							<td><input class="input sm" name="preis_{k.code}" value={k.priceText} inputmode="decimal" aria-label="Versand {k.name}" /></td>
							<td><input class="input sm" name="frei_{k.code}" value={k.freeFromText} inputmode="decimal" aria-label="Frei ab {k.name}" /></td>
							<td><input class="input sm" name="ust_{k.code}" value={(k.vatRate / 100).toString().replace('.', ',')} inputmode="decimal" aria-label="USt. {k.name}" /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
		<section class="card card-pad stack">
			<label class="check big"><input type="checkbox" name="abholung" checked={s.pickup.enabled} /><span><strong>Abholung anbieten</strong></span></label>
			<label class="field"><span class="label">Abholadresse</span><input class="input" name="abhol_adresse" value={s.pickup.address} /></label>
			<div class="grid-2">
				<label class="field"><span class="label">Hinweis</span><input class="input" name="abhol_hinweis" value={s.pickup.note} /></label>
				<label class="field"><span class="label">Englisch</span><input class="input" name="abhol_hinweis_en" value={s.pickup.noteEn} /></label>
			</div>
		</section>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>
{:else if tab === 'email'}
	<form method="POST" action="?/email" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<p class="hint">Zugangsdaten zum Postfach, über das Bestellbestätigungen verschickt werden (z. B. office@backyardboys.at). Die Daten stehen beim E-Mail-Anbieter (Microsoft 365: smtp.office365.com, Port 587, STARTTLS).</p>
		<div class="grid-3">
			<label class="field"><span class="label">SMTP-Server</span><input class="input" name="host" value={s.mail.host} placeholder="smtp.example.com" /></label>
			<label class="field"><span class="label">Port</span><input class="input" type="number" name="port" value={s.mail.port} /></label>
			<label class="field">
				<span class="label">Verschlüsselung</span>
				<select class="select" name="sicherheit" value={s.mail.secure ? 'ssl' : 'starttls'}><option value="starttls">STARTTLS (meist Port 587)</option><option value="ssl">SSL/TLS (meist Port 465)</option></select>
			</label>
		</div>
		<div class="grid-2">
			<label class="field"><span class="label">Benutzer</span><input class="input" name="benutzer" value={s.mail.user} autocomplete="off" /></label>
			<label class="field"><span class="label">Passwort {#if data.secrets.smtpPassword}<span class="opt">(hinterlegt)</span>{/if}</span><PasswordInput name="passwort" autocomplete="new-password" placeholder={data.secrets.smtpPassword ? 'leer lassen = unverändert' : ''} /></label>
		</div>
		<div class="grid-3">
			<label class="field"><span class="label">Absender-Adresse</span><input class="input" name="absender" value={s.mail.from} /></label>
			<label class="field"><span class="label">Absender-Name</span><input class="input" name="absender_name" value={s.mail.fromName} /></label>
			<label class="field"><span class="label">Team-Adresse <span class="opt">(falls niemand Meldungen bekommt)</span></span><input class="input" name="team" value={s.mail.teamFallback} /></label>
		</div>
		<div class="actionbar">
			<button class="btn btn-primary" disabled={busy}>Speichern & testen</button>
			<button class="btn" formaction="?/testmail" formnovalidate disabled={busy}>Test-E-Mail an mich</button>
		</div>
	</form>
	<section class="card card-pad block">
		<h2 class="card-title">Zuletzt verschickt</h2>
		{#if data.mails.length}
			<table class="table">
				<tbody>
					{#each data.mails as m (m.id)}
						<tr>
							<td class="small">{formatStamp(m.createdAt)}</td>
							<td class="small">{m.to}</td>
							<td class="small">{m.subject}</td>
							<td><span class="badge {m.status === 'gesendet' ? 'badge-ok' : m.status === 'fehler' ? 'badge-red' : 'badge-warn'}">{m.status === 'nicht_eingerichtet' ? 'nicht eingerichtet' : m.status}</span>{#if m.error}<br /><span class="small muted">{m.error}</span>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty">Noch keine E-Mails.</p>
		{/if}
	</section>
{:else if tab === 'haendler'}
	<form method="POST" action="?/haendler" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<div class="grid-2">
			<label class="field"><span class="label">Standard-Händlerrabatt %</span><input class="input" type="number" min="0" max="90" name="rabatt" value={s.dealers.defaultDiscount} /><span class="hint">Gilt, wenn beim Produkt kein eigener Händlerpreis und beim Kunden kein eigener Rabatt steht.</span></label>
			<label class="field"><span class="label">Enthaltene Korrekturschleifen (Full Custom)</span><input class="input" type="number" min="0" max="20" name="korrekturen" value={s.dekor.maxRevisions} /></label>
		</div>
		<label class="check"><input type="checkbox" name="anfragen" checked={s.dealers.applicationsOpen} /><span>Händler können sich im Shop bewerben</span></label>
		<div class="actionbar"><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>
{:else if tab === 'sicherung'}
	<section class="card card-pad">
		<div class="head">
			<div>
				<h2 class="card-title">Sicherungen</h2>
				<p class="card-sub">Jede Nacht ab 2 Uhr automatisch, die letzten 14 Stände bleiben am Server. Datenbank {formatBytes(data.sizes.db)}, Bilder {formatBytes(data.sizes.uploads)}. Zugangsdaten (Stripe, PayPal, SMTP) sind in Sicherungen verschlüsselt und müssen nach einem Umzug auf einen neuen Server neu eingetragen werden.</p>
			</div>
			<form method="POST" action="?/sichern" use:enhance={submitting(setBusy)}><button class="btn" disabled={busy}>{busy ? 'Sichern …' : 'Jetzt sichern'}</button></form>
		</div>
		{#if data.backups.length}
			<table class="table">
				<thead><tr><th>Stand</th><th>Datenbank</th><th>Dateien</th><th></th></tr></thead>
				<tbody>
					{#each data.backups as b (b.name)}
						<tr>
							<td>{formatStamp(b.createdAt)}</td>
							<td class="tabular">{formatBytes(b.dbSize)}</td>
							<td class="tabular">{b.images}</td>
							<td>
								<div class="actions">
									<a href="/admin/sicherung/{b.name}" class="btn btn-sm" download><Download size={15} /> Herunterladen</a>
									<button type="button" class="btn btn-sm btn-ghost" onclick={() => restore?.checkStand(b.name)}><RotateCcw size={15} /> Wiederherstellen</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="hint">Tipp: Ab und zu eine Sicherung herunterladen und zusätzlich an einem anderen Ort aufbewahren.</p>
		{:else}
			<p class="muted small">Noch keine Sicherung vorhanden.</p>
		{/if}
		<BackupRestore bind:this={restore} />
	</section>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1.25rem;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid var(--c-line);
	}
	.tabs a {
		padding: 0.6rem 0.9rem;
		color: var(--c-ink-2);
		font-weight: 650;
		text-decoration: none;
		white-space: nowrap;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.tabs a[aria-current='page'] {
		color: var(--c-ink);
		border-bottom-color: var(--c-accent);
	}
	.grid-3 {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 900px) {
		.grid-3 {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.sub {
		margin-top: 0.75rem;
	}
	.big {
		font-size: 1rem;
	}
	.oss {
		align-self: end;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1rem;
	}
	.input.sm {
		max-width: 8rem;
		height: 2.25rem;
	}
	.hidden {
		display: none;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.4rem;
	}
	.block {
		margin-top: 1.25rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	code {
		font-size: 0.82em;
		overflow-wrap: anywhere;
	}
</style>
