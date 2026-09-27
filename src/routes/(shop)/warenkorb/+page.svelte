<script lang="ts">
	import { enhance } from '$app/forms';
	import X from '@lucide/svelte/icons/x';
	import LineDetails from '$lib/components/shop/LineDetails.svelte';
	import Picture from '$lib/components/shop/Picture.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import Totals from '$lib/components/shop/Totals.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	const v = $derived(data.view);

	const keep = () => {
		return async ({ update }: { update: (o?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
		};
	};
</script>

<Seo title={i.tr('Warenkorb', 'Cart')} noindex />

<div class="wrap page-top section">
	<h1 class="display h1">{i.tr('Warenkorb', 'Cart')}</h1>

	{#if v.lines.length}
		<div class="layout">
			<ul class="lines">
				{#each v.lines as l (l.id)}
					<li class="line" class:problem={!!l.problem}>
						<a class="img" href={i.href(`/produkt/${l.slug}`)}>
							{#if l.image}<Picture media={l.image} sizes="140px" want={400} alt="" />{/if}
						</a>
						<div class="body">
							<div class="top">
								<a class="t" href={i.href(`/produkt/${l.slug}`)}>{l.title}</a>
								<form method="POST" action="?/entfernen" use:enhance={keep}>
									<input type="hidden" name="zeile" value={l.id} />
									<button class="icon-btn" aria-label={i.tr(`${l.title} entfernen`, `Remove ${l.title}`)}><X size={18} /></button>
								</form>
							</div>
							<LineDetails config={l.snapshot} variantTitle={l.variantTitle} isDeposit={l.isDeposit} />
							{#if l.problem}<p class="error-text">{l.problem}</p>{/if}
							<div class="bottom">
								{#if l.kind === 'dekor' || l.kind === 'gutschein'}
									<span class="muted small">{l.quantity} ×</span>
								{:else}
									<form method="POST" action="?/menge" use:enhance={keep} class="qty">
										<input type="hidden" name="zeile" value={l.id} />
										<button name="menge" value={l.quantity - 1} aria-label={i.tr('Weniger', 'Less')}>−</button>
										<span class="tabular" aria-label={i.tr('Menge', 'Quantity')}>{l.quantity}</span>
										<button name="menge" value={l.quantity + 1} aria-label={i.tr('Mehr', 'More')} disabled={l.limit != null && l.quantity >= l.limit}>+</button>
									</form>
								{/if}
								<span class="price tabular">
									{#if l.listUnitPrice > l.unitPrice && v.dealer}<s class="muted">{i.money(l.listUnitPrice * l.quantity)}</s>{/if}
									{i.money(l.lineTotal)}
								</span>
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<aside class="summary panel">
				<form method="POST" action="?/land" use:enhance={keep} class="field">
					<label class="label" for="land">{i.tr('Lieferland', 'Shipping country')}</label>
					<select id="land" name="land" class="select" value={v.country} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
						{#each data.countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
					</select>
				</form>

				<Totals t={v.totals} discountCode={v.discountCode} country={v.country} />

				{#if v.discountCode}
					<form method="POST" action="?/code_entfernen" use:enhance={keep} class="applied">
						<span>{i.tr('Code', 'Code')} <strong>{v.discountCode}</strong></span>
						<button class="link small">{i.tr('entfernen', 'remove')}</button>
					</form>
					{#if v.discountMessage}<p class="error-text">{v.discountMessage}</p>{/if}
				{/if}
				{#each v.giftCards as g (g.code)}
					<form method="POST" action="?/gutschein_entfernen" use:enhance={keep} class="applied">
						<input type="hidden" name="code" value={g.code} />
						<span>{i.tr('Gutschein', 'Gift card')} <strong>{g.code}</strong> <span class="muted small">({i.tr('Guthaben', 'balance')} {i.money(g.balance)})</span></span>
						<button class="link small">{i.tr('entfernen', 'remove')}</button>
					</form>
				{/each}

				<form method="POST" action="?/code" use:enhance={keep} class="code">
					<input class="input" name="code" placeholder={i.tr('Rabattcode oder Gutschein', 'Discount code or gift card')} aria-label={i.tr('Rabattcode oder Gutschein', 'Discount code or gift card')} autocapitalize="characters" />
					<button class="btn btn-ghost btn-sm">{i.tr('Einlösen', 'Apply')}</button>
				</form>
				{#if form?.codeError}<p class="error-text" role="alert">{form.codeError}</p>{/if}
				{#if form?.codeOk}<p class="small" style="color: var(--s-ok)" role="status">{form.codeOk}</p>{/if}

				<a class="btn btn-block" href={i.href('/kasse')} aria-disabled={!v.canCheckout} onclick={(e) => !v.canCheckout && e.preventDefault()}>{i.tr('Zur Kasse', 'Checkout')}</a>
				{#if !v.canCheckout}<p class="error-text">{i.tr('Bitte zuerst die markierten Artikel anpassen.', 'Please fix the marked items first.')}</p>{/if}
			</aside>
		</div>
	{:else}
		<div class="empty">
			<p class="lead">{i.tr('Dein Warenkorb ist leer.', 'Your cart is empty.')}</p>
			<a class="btn" href={i.href('/kategorie/bike-designs')}>{i.tr('Dekore ansehen', 'Browse graphics')}</a>
		</div>
	{/if}
</div>

<style>
	.layout {
		display: grid;
		gap: 2rem;
		margin-top: 2rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
			align-items: start;
		}
		.summary {
			position: sticky;
			top: calc(var(--header-h) + 1.5rem);
		}
	}
	.line {
		display: flex;
		gap: 1rem;
		padding-block: 1.25rem;
		border-bottom: 1px solid #27272a;
	}
	.line:first-child {
		border-top: 1px solid #27272a;
	}
	.line.problem .img {
		opacity: 0.5;
	}
	.img {
		flex-shrink: 0;
		align-self: flex-start;
		width: 7.5rem;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
	}
	@media (max-width: 480px) {
		.img {
			width: 5.5rem;
		}
	}
	.img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.top {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.t {
		color: #fff;
		font-weight: 750;
		font-stretch: 108%;
		text-transform: uppercase;
		text-decoration: none;
		line-height: 1.25;
	}
	.top .icon-btn {
		width: 2.2rem;
		height: 2.2rem;
		margin: -0.35rem -0.35rem 0 0;
	}
	.bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.4rem;
	}
	.qty {
		display: flex;
		align-items: center;
		box-shadow: inset 0 0 0 1px #3f3f46;
	}
	.qty button {
		width: 2.3rem;
		height: 2.3rem;
		color: #fff;
		font-size: 1.1rem;
	}
	.qty button:disabled {
		color: #52525b;
	}
	.qty span {
		min-width: 2rem;
		text-align: center;
		font-weight: 700;
	}
	.price {
		font-weight: 750;
		display: flex;
		gap: 0.5rem;
	}
	.summary {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.applied {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}
	.code {
		display: flex;
		gap: 0.5rem;
	}
	.code .btn {
		min-height: 3rem;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
		margin-top: 1.5rem;
	}
</style>
