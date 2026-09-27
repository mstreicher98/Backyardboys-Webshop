<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/admin/PasswordInput.svelte';

	let { data, form } = $props();
	let busy = $state(false);

	const submit = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<svelte:head><title>Zugang einrichten | BYB Intern</title></svelte:head>

<ol class="steps" aria-label="Schritte">
	<li class:done={data.step === 'app'} class:current={data.step === 'passwort'}>Passwort</li>
	<li class:current={data.step === 'app'}>Authenticator-App</li>
</ol>

{#if data.step === 'passwort'}
	<h1 class="title">Eigenes Passwort festlegen</h1>
	<p class="text">Hallo {data.name}! Bitte ersetze das vorläufige Passwort durch ein eigenes mit mindestens 10 Zeichen.</p>
	<form method="POST" action="?/passwort" class="stack" use:enhance={submit}>
		{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
		<label class="field">
			<span class="label">Neues Passwort</span>
			<PasswordInput name="passwort" autocomplete="new-password" minlength={10} required />
		</label>
		<label class="field">
			<span class="label">Passwort wiederholen</span>
			<PasswordInput name="passwort2" autocomplete="new-password" minlength={10} required />
		</label>
		<button class="btn btn-primary" disabled={busy}>Weiter</button>
	</form>
{:else}
	<h1 class="title">Authenticator-App koppeln</h1>
	<p class="text">
		Für die Anmeldung brauchst du zusätzlich einen Code vom Handy. Installiere dafür eine Authenticator-App, zum Beispiel Google Authenticator oder Microsoft Authenticator,
		und scanne diesen QR-Code.
	</p>
	{#if data.qr}
		<div class="qr" aria-label="QR-Code für die Authenticator-App">{@html data.qr}</div>
	{/if}
	<details class="manual">
		<summary>QR-Code lässt sich nicht scannen?</summary>
		<p>Gib in der App diesen Schlüssel von Hand ein (Typ: zeitbasiert):</p>
		<code>{data.secret}</code>
	</details>
	<form method="POST" action="?/app" class="stack" use:enhance={submit}>
		{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
		<label class="field">
			<span class="label">Code aus der App</span>
			<input class="input code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required />
		</label>
		<button class="btn btn-primary" disabled={busy}>Bestätigen und fertig</button>
	</form>
	<form method="POST" action="?/neu" use:enhance class="renew">
		<button class="btn btn-ghost btn-sm">Neuen QR-Code erzeugen</button>
	</form>
{/if}

<form method="POST" action="/admin/logout" class="logout">
	<button class="btn btn-ghost btn-sm">Abmelden</button>
</form>

<style>
	.steps {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--c-ink-3);
	}
	.steps li {
		flex: 1;
		padding-top: 0.5rem;
		border-top: 3px solid var(--c-line);
	}
	.steps .done {
		border-color: var(--c-ok);
		color: var(--c-ok);
	}
	.steps .current {
		border-color: var(--c-accent);
		color: var(--c-ink);
	}
	.title {
		font-size: 1.35rem;
		font-weight: 750;
		font-stretch: 85%;
	}
	.text {
		margin: 0.4rem 0 1.25rem;
		color: var(--c-ink-2);
	}
	.qr {
		width: 12.5rem;
		margin: 0 auto 1rem;
		padding: 0.5rem;
		background: #fff;
		border-radius: 10px;
		border: 1px solid var(--c-line);
	}
	.qr :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.manual {
		margin-bottom: 1.25rem;
		font-size: 0.875rem;
		color: var(--c-ink-2);
	}
	.manual summary {
		cursor: pointer;
		font-weight: 600;
	}
	.manual p {
		margin: 0.5rem 0;
	}
	.manual code {
		display: block;
		padding: 0.6rem;
		border-radius: 8px;
		background: var(--c-surface-3);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		word-break: break-all;
		user-select: all;
	}
	.code {
		font-size: 1.4rem !important;
		letter-spacing: 0.3em;
		text-align: center;
		font-weight: 700;
	}
	.renew,
	.logout {
		margin-top: 0.75rem;
		display: flex;
		justify-content: center;
	}
	.logout {
		margin-top: 0.25rem;
	}
</style>
