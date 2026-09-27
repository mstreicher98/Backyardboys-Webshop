<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	const v = $derived((form?.values ?? data.defaults) as Record<string, string>);
	const company = $derived(page.data.company as { email: string; phone: string; phoneHref: string; whatsappHref: string });
	let busy = $state(false);
</script>

<Seo title={i.tr('Kontakt & Anfragen', 'Contact & requests')} description={i.tr('Fragen zu Dekoren, Bestellungen oder Händlerkonditionen? Schreib uns.', 'Questions about graphics, orders or dealer terms? Get in touch.')} />

<div class="wrap page-top section layout">
	<div>
		<h1 class="display h1">{i.tr('Anfrage', 'Request')}</h1>
		<p class="lead">{i.tr('Fragen zu einem Dekor, deiner Bestellung oder einer Sonderanfertigung? Wir melden uns so schnell wie möglich.', 'Questions about graphics, your order or a special project? We will get back to you as soon as possible.')}</p>
		<ul class="direct">
			{#if company.email}<li><span class="muted small">{i.tr('E-Mail', 'Email')}</span><a class="link" href="mailto:{company.email}">{company.email}</a></li>{/if}
			{#if company.phone}<li><span class="muted small">{i.tr('Telefon', 'Phone')}</span><a class="link" href={company.phoneHref}>{company.phone}</a></li>{/if}
			{#if company.whatsappHref}<li><span class="muted small">WhatsApp</span><a class="link" href={company.whatsappHref} target="_blank" rel="noopener noreferrer">{i.tr('Nachricht schreiben', 'Send a message')}</a></li>{/if}
		</ul>
	</div>

	{#if form?.sent}
		<div class="panel">
			<h2 class="h3">{i.tr('Danke!', 'Thanks!')}</h2>
			<p class="muted">{i.tr('Deine Anfrage ist bei uns. Wir antworten per E-Mail.', "We've received your request and will reply by email.")}</p>
		</div>
	{:else}
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
				<label class="field"><span class="label">{i.tr('Name', 'Name')} *</span><input class="input" name="name" autocomplete="name" required value={v.name ?? ''} /></label>
				<label class="field"><span class="label">{i.tr('E-Mail', 'Email')} *</span><input class="input" name="email" type="email" autocomplete="email" required value={v.email ?? ''} /></label>
			</div>
			<div class="grid-2">
				<label class="field"><span class="label">{i.tr('Telefon', 'Phone')}</span><input class="input" name="telefon" type="tel" value={v.phone ?? ''} /></label>
				<label class="field"><span class="label">{i.tr('Betreff', 'Subject')}</span><input class="input" name="betreff" value={v.subject ?? data.subject} /></label>
			</div>
			<label class="field"><span class="label">{i.tr('Nachricht', 'Message')} *</span><textarea class="textarea" name="nachricht" required minlength="5" maxlength="5000">{v.message ?? ''}</textarea></label>
			<label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off" /></label>
			<label class="check">
				<input type="checkbox" name="datenschutz" required />
				<span class="small">{i.tr('Ich bin einverstanden, dass meine Angaben zur Beantwortung gespeichert werden. Mehr in der', 'I agree that my details are stored to answer my request. More in the')} <a class="link" href={i.href('/info/datenschutz')} target="_blank">{i.tr('Datenschutzerklärung', 'privacy policy')}</a>.</span>
			</label>
			<button class="btn" aria-busy={busy} disabled={busy}>{i.tr('Anfrage senden', 'Send request')}</button>
		</form>
	{/if}
</div>

<style>
	.layout {
		display: grid;
		gap: 2rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: 1fr 1.3fr;
			gap: 4rem;
			align-items: start;
		}
	}
	.lead {
		margin: 0.75rem 0 1.75rem;
	}
	.direct {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.direct li {
		display: flex;
		flex-direction: column;
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.box .btn {
		align-self: flex-start;
	}
	.hp {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
