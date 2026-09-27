<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('Passwort vergessen', 'Forgot password')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('Passwort vergessen', 'Forgot password')}</h1>
	{#if form?.sent}
		<p class="alert alert-ok lead" role="status">{i.tr(`Wenn es ein Konto für ${form.sent} gibt, ist der Link unterwegs. Er gilt eine Stunde.`, `If there is an account for ${form.sent}, the link is on its way. It is valid for one hour.`)}</p>
	{:else}
		<p class="lead">{i.tr('Gib deine E-Mail-Adresse ein – wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.', "Enter your email address – we'll send you a link to set a new password.")}</p>
		<form method="POST" class="panel box" use:enhance>
			{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
			<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" name="email" type="email" autocomplete="email" required /></label>
			<button class="btn">{i.tr('Link schicken', 'Send link')}</button>
		</form>
	{/if}
</div>

<style>
	.auth {
		max-width: 34rem;
	}
	.lead {
		margin: 0.75rem 0 1.75rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}
	.box .field {
		width: 100%;
	}
</style>
