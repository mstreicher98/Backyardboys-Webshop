<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/admin/PasswordInput.svelte';
	import PushToggle from '$lib/components/admin/PushToggle.svelte';
	import { submitting } from '$lib/formEnhance';
	import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '$lib/permissions';

	let { data } = $props();
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);
</script>

<svelte:head><title>Mein Konto | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Mein Konto</h1>
		<p class="page-sub">Angemeldet als <strong>{data.me.username}</strong>, Rolle {ROLE_LABELS[data.me.role]}: {ROLE_DESCRIPTIONS[data.me.role]}</p>
	</div>
</div>

<div class="cols">
	<form method="POST" action="?/meldungen" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<h2 class="card-title">Benachrichtigungen</h2>
		<p class="muted small">Bei neuen Bestellungen, Zahlungen, Nachrichten von Kunden, Freigaben und Anfragen.</p>
		<label class="check"><input type="checkbox" name="email" checked={data.notifyEmail} /><span>Per E-Mail{data.email ? ` an ${data.email}` : ' (E-Mail-Adresse unten eintragen)'}</span></label>
		<label class="check"><input type="checkbox" name="push" checked={data.notifyPush} /><span>Als Push-Nachricht auf meine Geräte</span></label>
		<div><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
		<div class="push">
			<p class="label">Dieses Gerät</p>
			<PushToggle />
		</div>
	</form>

	<form method="POST" action="?/profil" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<h2 class="card-title">Angaben</h2>
		<label class="field"><span class="label">Name</span><input class="input" name="name" value={data.me.name} required maxlength="80" /></label>
		<label class="field">
			<span class="label">E-Mail <span class="opt">(optional, zum Anmelden statt des Benutzernamens)</span></span>
			<input class="input" type="email" name="email" value={data.email} maxlength="120" />
		</label>
		<div><button class="btn btn-primary" disabled={busy}>Speichern</button></div>
	</form>

	<form method="POST" action="?/passwort" class="card card-pad stack" use:enhance={submitting(setBusy, { onSuccess: () => document.querySelectorAll<HTMLInputElement>('.pwf input').forEach((i) => (i.value = '')) })}>
		<h2 class="card-title">Passwort ändern</h2>
		<div class="pwf stack">
			<label class="field"><span class="label">Aktuelles Passwort</span><PasswordInput name="aktuell" autocomplete="current-password" required /></label>
			<label class="field"><span class="label">Neues Passwort</span><PasswordInput name="neu" autocomplete="new-password" minlength={10} required /></label>
			<label class="field"><span class="label">Neues Passwort wiederholen</span><PasswordInput name="neu2" autocomplete="new-password" minlength={10} required /></label>
		</div>
		<div><button class="btn btn-primary" disabled={busy}>Passwort ändern</button></div>
	</form>

	<form method="POST" action="?/app" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<h2 class="card-title">Authenticator-App</h2>
		<p class="muted small">Neues Handy? Hier die App neu koppeln. Danach wirst du durch die Einrichtung geführt.</p>
		<label class="field"><span class="label">Zur Bestätigung dein Passwort</span><PasswordInput name="aktuell" autocomplete="current-password" required /></label>
		<div><button class="btn" disabled={busy}>Authenticator-App neu einrichten</button></div>
	</form>

	<form method="POST" action="?/abmelden" class="card card-pad stack" use:enhance={submitting(setBusy)}>
		<h2 class="card-title">Angemeldete Geräte</h2>
		<p class="muted small">Du bist auf {data.devices} {data.devices === 1 ? 'Gerät' : 'Geräten'} angemeldet. Handy verloren? Dann hier alle anderen abmelden.</p>
		<div><button class="btn" disabled={busy || data.devices < 2}>Alle anderen Geräte abmelden</button></div>
	</form>
</div>

<style>
	.cols {
		display: grid;
		gap: 1rem;
	}
	.push {
		padding-top: 0.9rem;
		border-top: 1px solid var(--c-line);
	}
	@media (min-width: 1100px) {
		.cols {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}
</style>
