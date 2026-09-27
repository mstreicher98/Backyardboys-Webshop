<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('Neues Passwort', 'New password')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('Neues Passwort', 'New password')}</h1>
	{#if data.valid}
		<form method="POST" class="panel box" use:enhance>
			{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
			<label class="field"><span class="label">{i.tr('Neues Passwort', 'New password')}</span><input class="input" name="passwort" type="password" autocomplete="new-password" minlength="10" required /></label>
			<label class="field"><span class="label">{i.tr('Wiederholen', 'Repeat')}</span><input class="input" name="passwort2" type="password" autocomplete="new-password" minlength="10" required /></label>
			<button class="btn">{i.tr('Passwort speichern', 'Save password')}</button>
		</form>
	{:else}
		<p class="alert alert-error lead">{i.tr('Der Link ist abgelaufen oder wurde schon verwendet.', 'The link has expired or was already used.')}</p>
		<a class="btn" href={i.href('/konto/passwort-vergessen')}>{i.tr('Neuen Link anfordern', 'Request a new link')}</a>
	{/if}
</div>

<style>
	.auth {
		max-width: 34rem;
	}
	.lead {
		margin: 0.75rem 0 1.5rem;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1.5rem;
		align-items: flex-start;
	}
	.box .field {
		width: 100%;
	}
</style>
