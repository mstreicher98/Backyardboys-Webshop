<script lang="ts">
	import { enhance } from '$app/forms';
	import Smartphone from '@lucide/svelte/icons/smartphone';

	let { form } = $props();
	let busy = $state(false);
	let code = $state('');
	let formEl: HTMLFormElement;

	// Sechs Ziffern komplett → gleich absenden
	$effect(() => {
		if (/^\d{6}$/.test(code.replace(/\s/g, '')) && !busy) formEl?.requestSubmit();
	});
</script>

<svelte:head><title>Bestätigungscode | BYB Intern</title></svelte:head>

<div class="icon"><Smartphone size={26} /></div>
<h1 class="title">Bestätigungscode</h1>
<p class="text">Öffne deine Authenticator-App und gib den 6-stelligen Code für „Backyardboys Design“ ein.</p>

<form
	method="POST"
	class="stack"
	bind:this={formEl}
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update();
			busy = false;
			code = '';
		};
	}}
>
	{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
	<label class="field">
		<span class="label">Code</span>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			class="input code"
			name="code"
			bind:value={code}
			inputmode="numeric"
			autocomplete="one-time-code"
			pattern="[0-9 ]*"
			maxlength="7"
			required
			autofocus
		/>
	</label>
	<button class="btn btn-primary" disabled={busy}>{busy ? 'Prüfen …' : 'Bestätigen'}</button>
	<p class="hint">Kein Zugriff auf die App? Ein Admin kann die Zwei-Faktor-Anmeldung für dich zurücksetzen.</p>
	<a href="/admin/login" class="hint">Zurück zur Anmeldung</a>
</form>

<style>
	.icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 12px;
		background: var(--c-accent-soft);
		color: var(--c-accent);
	}
	.title {
		margin-top: 1rem;
		font-size: 1.35rem;
		font-weight: 750;
		font-stretch: 85%;
	}
	.text {
		margin: 0.4rem 0 1.25rem;
		color: var(--c-ink-2);
	}
	.code {
		font-size: 1.6rem !important;
		letter-spacing: 0.35em;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}
</style>
