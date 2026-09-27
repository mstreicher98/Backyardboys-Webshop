<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	const p = $derived(data.profile);
	const keep = () =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
		};
</script>

<Seo title={i.tr('Profil', 'Profile')} noindex />

<div class="cols">
	<form method="POST" action="?/daten" class="panel box" use:enhance={keep}>
		<h2 class="h3">{i.tr('Deine Daten', 'Your details')}</h2>
		{#if form?.ok}<p class="alert alert-ok">{form.ok}</p>{/if}
		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		<div class="grid-2">
			<label class="field"><span class="label">{i.tr('Vorname', 'First name')}</span><input class="input" name="vorname" required value={p.firstName} /></label>
			<label class="field"><span class="label">{i.tr('Nachname', 'Last name')}</span><input class="input" name="nachname" required value={p.lastName} /></label>
		</div>
		<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" value={p.email} disabled /><span class="hint">{i.tr('Zum Ändern der E-Mail-Adresse schreib uns bitte.', 'To change your email address, please contact us.')}</span></label>
		<label class="field"><span class="label">{i.tr('Telefon', 'Phone')}</span><input class="input" name="telefon" type="tel" value={p.phone} /></label>
		<div class="grid-2">
			<label class="field"><span class="label">{i.tr('Firma', 'Company')}</span><input class="input" name="firma" value={p.company} /></label>
			<label class="field"><span class="label">{i.tr('UID-Nummer', 'VAT ID')}</span><input class="input" name="uid" value={p.vatId} /></label>
		</div>
		<label class="field">
			<span class="label">{i.tr('Sprache für E-Mails', 'Language for emails')}</span>
			<select class="select" name="sprache" value={p.locale}><option value="de">Deutsch</option><option value="en">English</option></select>
		</label>
		<button class="btn">{i.tr('Speichern', 'Save')}</button>
	</form>

	<div class="side">
		<form method="POST" action="?/passwort" class="panel box" use:enhance>
			<h2 class="h3">{p.hasPassword ? i.tr('Passwort ändern', 'Change password') : i.tr('Passwort festlegen', 'Set password')}</h2>
			{#if form?.pwOk}<p class="alert alert-ok">{form.pwOk}</p>{/if}
			{#if form?.pwError}<p class="alert alert-error">{form.pwError}</p>{/if}
			{#if p.hasPassword}<label class="field"><span class="label">{i.tr('Bisheriges Passwort', 'Current password')}</span><input class="input" name="alt" type="password" autocomplete="current-password" required /></label>{/if}
			<label class="field"><span class="label">{i.tr('Neues Passwort', 'New password')}</span><input class="input" name="neu" type="password" autocomplete="new-password" minlength="10" required /></label>
			<label class="field"><span class="label">{i.tr('Wiederholen', 'Repeat')}</span><input class="input" name="neu2" type="password" autocomplete="new-password" minlength="10" required /></label>
			<button class="btn btn-ghost">{i.tr('Passwort speichern', 'Save password')}</button>
		</form>

		<form method="POST" action="?/loeschen" class="panel box" use:enhance>
			<h2 class="h3">{i.tr('Konto löschen', 'Delete account')}</h2>
			{#if form?.deleteRequested}
				<p class="alert alert-ok">{i.tr('Anfrage erhalten. Wir löschen dein Konto und melden uns per E-Mail.', "Request received. We'll delete your account and confirm by email.")}</p>
			{:else}
				<p class="muted small">{i.tr('Rechnungen müssen wir gesetzlich 7 Jahre aufbewahren; alle anderen Daten löschen wir.', 'We are legally required to keep invoices for 7 years; all other data will be deleted.')}</p>
				<button class="btn btn-ghost btn-sm">{i.tr('Löschung anfragen', 'Request deletion')}</button>
			{/if}
		</form>
	</div>
</div>

<style>
	.cols {
		display: grid;
		gap: 1.5rem;
	}
	@media (min-width: 1024px) {
		.cols {
			grid-template-columns: 1.4fr 1fr;
			align-items: start;
		}
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: stretch;
	}
	.box .btn {
		align-self: flex-start;
	}
</style>
