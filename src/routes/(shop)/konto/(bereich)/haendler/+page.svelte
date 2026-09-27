<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
</script>

<Seo title={i.tr('Für Händler', 'For dealers')} noindex />

<div class="narrow">
	<h2 class="display h2">{i.tr('Für Händler', 'For dealers')}</h2>
	{#if data.status === 'freigegeben'}
		<p class="alert alert-ok">{i.tr('Dein Händlerzugang ist aktiv – im Shop siehst du deine Händlerpreise.', 'Your dealer account is active – you see your dealer prices in the shop.')}</p>
	{:else if data.status === 'angefragt' || form?.sent}
		<p class="alert alert-info">{i.tr('Deine Anfrage ist bei uns. Wir prüfen sie und melden uns per E-Mail.', "We've received your request. We'll review it and get back to you by email.")}</p>
	{:else if !data.open}
		<p class="alert alert-info">{i.tr('Derzeit nehmen wir keine neuen Händler auf.', "We're not accepting new dealers at the moment.")}</p>
	{:else}
		<p class="lead">{i.tr('Du verkaufst Bikes, betreibst eine Werkstatt oder ein Team? Mit einem Händlerzugang bekommst du eigene Preise.', 'You sell bikes, run a workshop or a team? A dealer account gets you dealer prices.')}</p>
		{#if data.status === 'abgelehnt'}<p class="alert alert-info">{i.tr('Deine letzte Anfrage konnten wir leider nicht freigeben. Melde dich gern bei Fragen.', "We couldn't approve your last request. Feel free to contact us with questions.")}</p>{/if}
		<form method="POST" class="panel box" use:enhance>
			{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
			<label class="field"><span class="label">{i.tr('Firma', 'Company')} *</span><input class="input" name="firma" required value={data.company} /></label>
			<label class="field"><span class="label">{i.tr('UID-Nummer', 'VAT ID')} *</span><input class="input" name="uid" required value={data.vatId} placeholder="ATU12345678" /></label>
			<label class="field"><span class="label">{i.tr('Kurz zu dir (optional)', 'About you (optional)')}</span><textarea class="textarea" name="nachricht" maxlength="2000"></textarea></label>
			<button class="btn">{i.tr('Händlerzugang anfragen', 'Request dealer account')}</button>
		</form>
	{/if}
</div>

<style>
	.narrow {
		max-width: 40rem;
	}
	.lead {
		margin: 0.75rem 0 1.5rem;
	}
	.alert {
		margin-top: 1rem;
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
