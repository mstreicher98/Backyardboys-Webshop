<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/admin/PasswordInput.svelte';
	import { formatBackupName } from '$lib/format';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Anmelden | BYB Intern</title></svelte:head>

<h1 class="title">Anmelden</h1>

<form
	method="POST"
	class="stack"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	{#if data.restored && !form}
		<p class="alert alert-ok" role="status">
			Sicherung wiederhergestellt. Bitte mit den Zugangsdaten aus der Sicherung anmelden. Der Stand davor liegt unter Einstellungen als Sicherung vom {formatBackupName(data.restored)}.
		</p>
	{/if}
	{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
	<label class="field">
		<span class="label">Benutzername oder E-Mail</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input class="input" name="benutzer" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.identifier ?? ''} autofocus />
	</label>
	<label class="field">
		<span class="label">Passwort</span>
		<PasswordInput name="passwort" autocomplete="current-password" required />
	</label>
	<label class="check">
		<input type="checkbox" name="merken" />
		<span>Auf diesem Gerät 30 Tage angemeldet bleiben</span>
	</label>
	<button class="btn btn-primary" disabled={busy}>{busy ? 'Anmelden …' : 'Anmelden'}</button>
	<p class="hint">Passwort vergessen? Ein Admin kann es zurücksetzen.</p>
</form>

<style>
	.title {
		margin-bottom: 1.25rem;
		font-size: 1.35rem;
		font-weight: 750;
		font-stretch: 85%;
	}
</style>
