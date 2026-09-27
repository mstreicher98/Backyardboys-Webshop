<script lang="ts">
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('E-Mail bestätigen', 'Confirm email')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('E-Mail bestätigen', 'Confirm email')}</h1>
	{#if data.valid}
		<p class="lead">{i.tr(`Adresse ${data.email} bestätigen und Konto aktivieren?`, `Confirm ${data.email} and activate your account?`)}</p>
		<form method="POST"><button class="btn">{i.tr('Bestätigen', 'Confirm')}</button></form>
	{:else}
		<p class="alert alert-error lead">{i.tr('Der Link ist abgelaufen oder wurde schon verwendet. Melde dich einfach an – wir schicken dir bei Bedarf einen neuen.', "The link has expired or was already used. Just log in – we'll send you a new one if needed.")}</p>
		<a class="btn" href={i.href('/konto/anmelden')}>{i.tr('Zur Anmeldung', 'Go to login')}</a>
	{/if}
</div>

<style>
	.auth {
		max-width: 34rem;
	}
	.lead {
		margin: 1rem 0 1.5rem;
	}
</style>
