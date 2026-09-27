<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	let method = $state(data.methods.find((m) => m.id === data.payment.method)?.id ?? data.methods[0]?.id ?? '');
	let busy = $state(false);
</script>

<Seo title={i.tr('Zahlung', 'Payment')} noindex />

<div class="wrap page-top section narrow">
	<p class="muted">{i.tr('Bestellung', 'Order')} {data.order.number}</p>
	{#if data.state === 'bezahlt'}
		<h1 class="display h1">{i.tr('Danke – bezahlt!', 'Thanks – paid!')}</h1>
		<span class="grad-bar" aria-hidden="true"></span>
		<p class="lead">
			{data.payment.purpose === 'restzahlung'
				? i.tr('Deine Restzahlung ist angekommen. Dein Dekor geht jetzt in Produktion.', 'Your remaining payment has arrived. Your graphics are now going into production.')
				: i.tr('Deine Zahlung ist angekommen. Die Bestätigung kommt per E-Mail.', 'Your payment has arrived. The confirmation is on its way by email.')}
		</p>
		<a class="btn" href={i.href(`/bestellung/${data.order.token}`)}>{i.tr('Zur Bestellung', 'View order')}</a>
	{:else if data.cancelled}
		<h1 class="display h1">{i.tr('Zahlung nicht mehr offen', 'Payment no longer open')}</h1>
		<p class="lead">{i.tr('Diese Zahlung wurde storniert oder ersetzt.', 'This payment has been cancelled or replaced.')}</p>
		<a class="btn btn-ghost" href={i.href(`/bestellung/${data.order.token}`)}>{i.tr('Zur Bestellung', 'View order')}</a>
	{:else}
		<h1 class="display h1">
			{data.payment.purpose === 'restzahlung' ? i.tr('Restzahlung', 'Remaining payment') : i.tr('Bezahlen', 'Payment')}
		</h1>
		<p class="amount tabular">{i.money(data.payment.amount)}</p>

		{#if data.state === 'pruefung'}
			<p class="alert alert-info">{i.tr('Deine Zahlung wird noch bestätigt (z. B. bei SEPA-Lastschrift). Du bekommst eine E-Mail, sobald sie da ist.', "Your payment is still being confirmed (e.g. SEPA direct debit). You'll get an email as soon as it arrives.")}</p>
		{:else if data.state === 'abgebrochen'}
			<p class="alert alert-info">{i.tr('Die Zahlung wurde abgebrochen. Du kannst es gleich nochmal versuchen.', 'The payment was cancelled. You can try again right away.')}</p>
		{:else if data.state === 'fehlgeschlagen'}
			<p class="alert alert-error">{i.tr('Die Zahlung hat nicht geklappt. Bitte versuche es erneut oder wähle eine andere Zahlungsart.', "The payment didn't go through. Please try again or choose another method.")}</p>
		{/if}

		{#if data.bank && data.payment.method === 'ueberweisung' && (form?.ok || data.state !== 'abgebrochen')}
			<div class="panel bank">
				<h2 class="h3">{i.tr('Überweisung', 'Bank transfer')}</h2>
				<dl>
					<div><dt>{i.tr('Empfänger', 'Recipient')}</dt><dd>{data.bank.name}</dd></div>
					<div><dt>IBAN</dt><dd>{data.bank.iban}</dd></div>
					{#if data.bank.bic}<div><dt>BIC</dt><dd>{data.bank.bic}</dd></div>{/if}
					<div><dt>{i.tr('Betrag', 'Amount')}</dt><dd>{i.money(data.payment.amount)}</dd></div>
					<div><dt>{i.tr('Verwendungszweck', 'Reference')}</dt><dd>{i.tr('Bestellung', 'Order')} {data.order.number}</dd></div>
				</dl>
				<p class="muted small">{i.tr(`Bitte innerhalb von ${data.bank.days} Tagen überweisen.`, `Please transfer within ${data.bank.days} days.`)}</p>
			</div>
		{/if}

		<form
			method="POST"
			class="choose"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					if (result.type === 'success' && typeof result.data?.redirect === 'string') {
						location.href = result.data.redirect;
						return;
					}
					busy = false;
					await update({ reset: false });
				};
			}}
		>
			<fieldset class="options">
				<legend class="label">{i.tr('Zahlungsart', 'Payment method')}</legend>
				{#each data.methods as m (m.id)}
					<label class="option" class:on={method === m.id}>
						<input type="radio" name="zahlung" value={m.id} bind:group={method} />
						<strong>{m.label}</strong>
					</label>
				{/each}
			</fieldset>
			{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
			<button class="btn" aria-busy={busy} disabled={busy || !method}>
				{method === 'ueberweisung' ? i.tr('Per Überweisung zahlen', 'Pay by bank transfer') : i.tr('Jetzt bezahlen', 'Pay now')}
			</button>
		</form>
		<p class="small"><a class="link" href={i.href(`/bestellung/${data.order.token}`)}>{i.tr('Zur Bestellung', 'View order')}</a></p>
	{/if}
</div>

<style>
	.narrow {
		max-width: 44rem;
	}
	.grad-bar {
		display: block;
		width: 6rem;
		height: 0.35rem;
		margin: 1.25rem 0;
		background: var(--grad);
		box-shadow: var(--glow);
		transform-origin: left;
		animation: draw 900ms var(--ease-expo) 200ms both;
		transform: skewX(-24deg);
	}
	.lead {
		margin-bottom: 1.75rem;
	}
	.amount {
		margin: 0.75rem 0 1.5rem;
		font-size: 2.25rem;
		font-weight: 800;
		font-stretch: 110%;
	}
	.alert {
		margin-bottom: 1.25rem;
	}
	.bank {
		margin-bottom: 1.5rem;
	}
	.bank dl {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.75rem 0;
	}
	.bank div {
		display: flex;
		gap: 1rem;
	}
	.bank dt {
		min-width: 9rem;
		color: #a1a1aa;
	}
	.choose {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		border: 0;
		padding: 0;
	}
	.options legend {
		margin-bottom: 0.5rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 1rem;
		background: #18181b;
		box-shadow: inset 0 0 0 1px #27272a;
		cursor: pointer;
	}
	.option {
		transition:
			box-shadow 220ms var(--ease-out),
			background-color 220ms;
	}
	.option:hover {
		box-shadow: inset 0 0 0 1px #52525b;
	}
	.option.on {
		background: #1c1a24;
		box-shadow:
			inset 0 0 0 2px #9775fa,
			0 14px 34px -22px rgb(121 80 242 / 0.9);
	}
	.option input {
		accent-color: #7950f2;
	}
	@keyframes draw {
		from {
			transform: skewX(-24deg) scaleX(0);
		}
	}
</style>
