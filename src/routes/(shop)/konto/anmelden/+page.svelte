<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	let mode = $state<'passwort' | 'link'>('passwort');
	let busy = $state(false);
	const q = $derived(data.weiter !== '/konto' ? `?weiter=${encodeURIComponent(data.weiter)}` : '');
	const keep = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<Seo title={i.tr('Anmelden', 'Log in')} noindex />

<div class="wrap page-top section auth">
	<h1 class="display h1">{i.tr('Anmelden', 'Log in')}</h1>
	<p class="lead">{i.tr('Sieh deine Bestellungen, Rechnungen und Entwürfe an einem Ort.', 'See your orders, invoices and designs in one place.')}</p>

	{#if data.hinweis === 'bestaetigt'}<p class="alert alert-ok">{i.tr('E-Mail bestätigt – du kannst dich jetzt anmelden.', 'Email confirmed – you can log in now.')}</p>{/if}
	{#if data.hinweis === 'link_ungueltig'}<p class="alert alert-error">{i.tr('Der Link ist abgelaufen oder wurde schon verwendet. Fordere einfach einen neuen an.', 'The link has expired or was already used. Just request a new one.')}</p>{/if}

	<div class="tabs" role="tablist">
		<button type="button" role="tab" aria-selected={mode === 'passwort'} onclick={() => (mode = 'passwort')}>{i.tr('Mit Passwort', 'With password')}</button>
		<button type="button" role="tab" aria-selected={mode === 'link'} onclick={() => (mode = 'link')}>{i.tr('Link per E-Mail', 'Link by email')}</button>
	</div>

	{#if mode === 'passwort'}
		<form method="POST" action="?/passwort{q}" class="panel box" use:enhance={keep}>
			{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
			<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} /></label>
			<label class="field"><span class="label">{i.tr('Passwort', 'Password')}</span><input class="input" name="passwort" type="password" autocomplete="current-password" required /></label>
			<label class="check"><input type="checkbox" name="merken" /><span>{i.tr('Angemeldet bleiben', 'Keep me logged in')}</span></label>
			<button class="btn" aria-busy={busy} disabled={busy}>{i.tr('Anmelden', 'Log in')}</button>
			<a class="link small" href={i.href('/konto/passwort-vergessen')}>{i.tr('Passwort vergessen?', 'Forgot password?')}</a>
		</form>
	{:else}
		<form method="POST" action="?/link{q}" class="panel box" use:enhance={keep}>
			{#if form?.linkSent}
				<p class="alert alert-ok" role="status">{i.tr(`Wenn es ein Konto für ${form.linkSent} gibt oder du dort schon bestellt hast, ist der Link unterwegs. Er gilt 30 Minuten.`, `If ${form.linkSent} has an account or has ordered before, the link is on its way. It is valid for 30 minutes.`)}</p>
			{/if}
			{#if form?.linkError}<p class="alert alert-error" role="alert">{form.linkError}</p>{/if}
			<p class="muted small">{i.tr('Kein Passwort nötig: Wir schicken dir einen Link, mit dem du direkt angemeldet bist. Funktioniert auch, wenn du bisher nur ohne Konto bestellt hast.', "No password needed: we'll send you a link that logs you in. Also works if you've only ordered without an account so far.")}</p>
			<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} /></label>
			<button class="btn" aria-busy={busy} disabled={busy}>{i.tr('Link schicken', 'Send link')}</button>
		</form>
	{/if}

	<p class="more">{i.tr('Noch kein Konto?', 'No account yet?')} <a class="link" href={i.href('/konto/registrieren')}>{i.tr('Jetzt registrieren', 'Register now')}</a></p>
</div>

<style>
	.auth {
		max-width: 34rem;
	}
	.lead {
		margin: 0.75rem 0 1.75rem;
	}
	.alert {
		margin-bottom: 1rem;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
	}
	.tabs button {
		flex: 1;
		height: 2.9rem;
		color: #a1a1aa;
		font-weight: 700;
		background: #0f0f11;
	}
	.tabs button[aria-selected='true'] {
		background: #18181b;
		color: #fff;
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
	.more {
		margin-top: 1.5rem;
	}
</style>
