<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { form } = $props();
	const i = getI18n();
	let busy = $state(false);
	const v = $derived((form?.values ?? {}) as { email?: string; firstName?: string; lastName?: string });
</script>

<Seo title={i.tr('Registrieren', 'Register')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('Konto anlegen', 'Create account')}</h1>
	{#if form?.sent}
		<p class="alert alert-ok lead" role="status">
			{i.tr(`Fast geschafft! Wir haben dir eine E-Mail an ${form.sent} geschickt. Bitte bestätige darin deine Adresse.`, `Almost done! We've sent an email to ${form.sent}. Please confirm your address there.`)}
		</p>
	{:else}
		<p class="lead">{i.tr('Bestellungen, die du früher ohne Konto mit derselben E-Mail aufgegeben hast, erscheinen nach der Bestätigung automatisch.', 'Orders you placed earlier without an account using the same email will show up automatically after confirmation.')}</p>
		<form
			method="POST"
			class="panel box"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
			<div class="grid-2">
				<label class="field"><span class="label">{i.tr('Vorname', 'First name')}</span><input class="input" name="vorname" autocomplete="given-name" required value={v.firstName ?? ''} /></label>
				<label class="field"><span class="label">{i.tr('Nachname', 'Last name')}</span><input class="input" name="nachname" autocomplete="family-name" required value={v.lastName ?? ''} /></label>
			</div>
			<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" name="email" type="email" autocomplete="email" required value={v.email ?? ''} /></label>
			<label class="field">
				<span class="label">{i.tr('Passwort', 'Password')}</span>
				<input class="input" name="passwort" type="password" autocomplete="new-password" minlength="10" required />
				<span class="hint">{i.tr('Mindestens 10 Zeichen.', 'At least 10 characters.')}</span>
			</label>
			<label class="check">
				<input type="checkbox" name="datenschutz" required />
				<span class="small">{i.tr('Ich habe die', 'I have read the')} <a class="link" href={i.href('/info/datenschutz')} target="_blank">{i.tr('Datenschutzerklärung', 'privacy policy')}</a> {i.tr('gelesen.', '.')}</span>
			</label>
			<button class="btn" aria-busy={busy} disabled={busy}>{i.tr('Konto anlegen', 'Create account')}</button>
		</form>
		<p class="more">{i.tr('Schon registriert?', 'Already registered?')} <a class="link" href={i.href('/konto/anmelden')}>{i.tr('Anmelden', 'Log in')}</a></p>
	{/if}
</div>

<style>
	.auth {
		max-width: 38rem;
	}
	.lead {
		margin: 0.75rem 0 1.75rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.box .btn {
		align-self: flex-start;
	}
	.more {
		margin-top: 1.5rem;
	}
</style>
