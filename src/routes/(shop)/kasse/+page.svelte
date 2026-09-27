<script lang="ts">
	import { enhance } from '$app/forms';
	import LineDetails from '$lib/components/shop/LineDetails.svelte';
	import Picture from '$lib/components/shop/Picture.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import Totals from '$lib/components/shop/Totals.svelte';
	import { getI18n } from '$lib/i18n.svelte';
	import type { Totals as TotalsType } from '$lib/server/shop/pricing';

	let { data, form } = $props();
	const i = getI18n();

	const val = (k: string, fallback = '') => (form?.values as Record<string, string> | undefined)?.[k] ?? fallback;
	const bad = (k: string) => ((form?.invalid as string[] | undefined) ?? []).includes(k);

	const first = data.addresses[0];
	const d = data.defaults;
	let method = $state<'versand' | 'abholung'>(val('lieferung', 'versand') === 'abholung' ? 'abholung' : 'versand');
	let rgLand = $state(val('rg_land', first?.country ?? data.view.country));
	let lfLand = $state(val('lf_land', data.view.country));
	let separate = $state(val('andere_lieferadresse') === 'on');
	let asCompany = $state(val('firma_bestellung') === 'on' || !!d.vatId);
	let uid = $state(val('uid', d.vatId));
	let email = $state(val('email', d.email));
	let totals = $state<TotalsType>(data.view.totals);
	let country = $state(data.view.country);
	let vatInfo = $state<{ valid: boolean; checked: boolean } | null>(null);
	let busy = $state(false);

	const physical = $derived(data.view.needsDelivery);
	const shipCountry = $derived(separate ? lfLand : rgLand);
	const shipAllowed = $derived(!physical || method === 'abholung' || data.shipCountries.some((c) => c.code === shipCountry));
	const payList = $derived(method === 'abholung' ? data.payments.abholung : data.payments.versand);
	let payment = $state(val('zahlung', ''));
	$effect(() => {
		if (!payList.some((p) => p.id === payment)) payment = payList[0]?.id ?? '';
	});

	// Summen neu berechnen, wenn sich Land, Versandart oder UID ändern
	let timer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const body = JSON.stringify({ country: shipCountry, billingCountry: rgLand, method, vatId: asCompany ? uid : '', locale: i.locale, email });
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			try {
				const res = await fetch('/api/kasse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
				if (!res.ok) return;
				const r = await res.json();
				totals = r.totals;
				country = r.country;
				vatInfo = r.vat.vatId ? { valid: r.vat.valid, checked: r.vat.checked } : null;
			} catch {
				/* Anzeige bleibt beim letzten Stand */
			}
		}, 350);
	});

	const methodInfo: Record<string, { de: string; en: string }> = {
		stripe: { de: 'Weiterleitung zu Stripe: Kreditkarte, Apple Pay, Google Pay, EPS, Klarna, SEPA', en: 'Redirect to Stripe: credit card, Apple Pay, Google Pay, EPS, Klarna, SEPA' },
		paypal: { de: 'Weiterleitung zu PayPal', en: 'Redirect to PayPal' },
		ueberweisung: { de: `Bankverbindung kommt mit der Bestätigung; zahlbar in ${data.transferDays} Tagen`, en: `Bank details come with the confirmation; payable within ${data.transferDays} days` },
		bar: { de: 'Bar bei der Abholung', en: 'Cash on pickup' }
	};

	function useAddress(id: number) {
		const a = data.addresses.find((x) => x.id === id);
		if (!a) return;
		const f = document.getElementById('kasse') as HTMLFormElement;
		const set = (name: string, v: string) => {
			const el = f.elements.namedItem(name) as HTMLInputElement | null;
			if (el) el.value = v;
		};
		set('rg_vorname', a.firstName);
		set('rg_nachname', a.lastName);
		set('rg_firma', a.company);
		set('rg_strasse', a.street);
		set('rg_plz', a.zip);
		set('rg_ort', a.city);
		rgLand = a.country;
	}
</script>

<Seo title={i.tr('Kasse', 'Checkout')} noindex />

<div class="wrap page-top section">
	<h1 class="display h1">{i.tr('Kasse', 'Checkout')}</h1>

	<form
		id="kasse"
		method="POST"
		class="layout"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				if (result.type === 'success' && typeof result.data?.redirect === 'string') {
					location.href = result.data.redirect;
					return;
				}
				busy = false;
				await update({ reset: false });
				if (result.type === 'failure') document.querySelector('[aria-invalid="true"], .alert-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			};
		}}
	>
		<div class="steps">
			<!-- Kontakt -->
			<section class="block">
				<h2 class="h3">{i.tr('Kontakt', 'Contact')}</h2>
				{#if data.loggedIn}
					<p class="muted">{i.tr('Angemeldet als', 'Logged in as')} <strong>{d.email}</strong></p>
				{:else}
					<p class="muted small">{i.tr('Schon Kunde?', 'Already a customer?')} <a class="link" href={i.href('/konto/anmelden?weiter=/kasse')}>{i.tr('Anmelden', 'Log in')}</a></p>
				{/if}
				<div class="grid-2">
					{#if !data.loggedIn}
						<label class="field">
							<span class="label">{i.tr('E-Mail', 'Email')} <span class="req">*</span></span>
							<input class="input" name="email" type="email" autocomplete="email" required bind:value={email} aria-invalid={bad('email')} />
						</label>
					{/if}
					<label class="field">
						<span class="label">{i.tr('Telefon', 'Phone')} <span class="req">({i.tr('für Rückfragen', 'for questions')})</span></span>
						<input class="input" name="telefon" type="tel" autocomplete="tel" value={val('telefon', d.phone)} />
					</label>
				</div>
			</section>

			<!-- Rechnungsadresse -->
			<section class="block">
				<div class="block-head">
					<h2 class="h3">{i.tr('Rechnungsadresse', 'Billing address')}</h2>
					{#if data.addresses.length > 1}
						<select class="select small-select" onchange={(e) => useAddress(Number(e.currentTarget.value))} aria-label={i.tr('Gespeicherte Adresse', 'Saved address')}>
							{#each data.addresses as a (a.id)}<option value={a.id}>{a.firstName} {a.lastName}, {a.city}</option>{/each}
						</select>
					{/if}
				</div>
				<div class="grid-2">
					<label class="field"><span class="label">{i.tr('Vorname', 'First name')} <span class="req">*</span></span><input class="input" name="rg_vorname" autocomplete="given-name" required value={val('rg_vorname', first?.firstName ?? d.firstName)} aria-invalid={bad('rg_vorname')} /></label>
					<label class="field"><span class="label">{i.tr('Nachname', 'Last name')} <span class="req">*</span></span><input class="input" name="rg_nachname" autocomplete="family-name" required value={val('rg_nachname', first?.lastName ?? d.lastName)} aria-invalid={bad('rg_nachname')} /></label>
				</div>
				<label class="check">
					<input type="checkbox" name="firma_bestellung" bind:checked={asCompany} />
					<span>{i.tr('Ich bestelle für eine Firma', "I'm ordering for a company")}</span>
				</label>
				{#if asCompany}
					<div class="grid-2">
						<label class="field"><span class="label">{i.tr('Firma', 'Company')}</span><input class="input" name="rg_firma" autocomplete="organization" value={val('rg_firma', first?.company ?? d.company)} /></label>
						<label class="field">
							<span class="label">{i.tr('UID-Nummer', 'VAT ID')}</span>
							<input class="input" name="uid" bind:value={uid} placeholder="z. B. DE123456789" autocapitalize="characters" />
							{#if data.taxMode === 'regel' && vatInfo}
								<span class="hint" style:color={vatInfo.valid ? 'var(--s-ok)' : undefined}>
									{vatInfo.valid
										? i.tr('UID gültig – Lieferung ohne USt. (Reverse Charge)', 'VAT ID valid – delivery without VAT (reverse charge)')
										: vatInfo.checked
											? i.tr('UID nicht gültig oder passt nicht zum Land – Preise inkl. USt.', 'VAT ID not valid or does not match the country – prices incl. VAT')
											: i.tr('UID konnte gerade nicht geprüft werden – Preise inkl. USt.', 'VAT ID could not be checked right now – prices incl. VAT')}
								</span>
							{/if}
						</label>
					</div>
				{:else}
					<input type="hidden" name="rg_firma" value="" />
				{/if}
				<label class="field"><span class="label">{i.tr('Straße und Hausnummer', 'Street and number')} <span class="req">*</span></span><input class="input" name="rg_strasse" autocomplete="street-address" required value={val('rg_strasse', first?.street ?? '')} aria-invalid={bad('rg_strasse')} /></label>
				<div class="grid-3">
					<label class="field"><span class="label">{i.tr('PLZ', 'Postcode')} <span class="req">*</span></span><input class="input" name="rg_plz" autocomplete="postal-code" required value={val('rg_plz', first?.zip ?? '')} aria-invalid={bad('rg_plz')} /></label>
					<label class="field"><span class="label">{i.tr('Ort', 'City')} <span class="req">*</span></span><input class="input" name="rg_ort" autocomplete="address-level2" required value={val('rg_ort', first?.city ?? '')} aria-invalid={bad('rg_ort')} /></label>
					<label class="field">
						<span class="label">{i.tr('Land', 'Country')} <span class="req">*</span></span>
						<select class="select" name="rg_land" autocomplete="country" bind:value={rgLand} aria-invalid={bad('rg_land') || bad('country')}>
							{#each data.billCountries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
						</select>
					</label>
				</div>
				{#if data.loggedIn}
					<label class="check"><input type="checkbox" name="adresse_speichern" /><span>{i.tr('Adresse in meinem Konto speichern', 'Save address to my account')}</span></label>
				{/if}
			</section>

			<!-- Lieferung -->
			{#if physical}
				<section class="block">
					<h2 class="h3">{i.tr('Lieferung', 'Delivery')}</h2>
					{#if data.view.onlyDigital}<p class="muted small">{i.tr('Dein Dekor verschicken wir nach der Fertigung. Die Versandkosten kommen mit der Restzahlung.', 'We ship your graphics once they are made. Shipping is charged with the remaining payment.')}</p>{/if}
					<div class="options">
						<label class="option" class:on={method === 'versand'}>
							<input type="radio" name="lieferung" value="versand" bind:group={method} />
							<span><strong>{i.tr('Versand', 'Shipping')}</strong><span class="muted small">{i.tr('an deine Adresse', 'to your address')}</span></span>
						</label>
						{#if data.pickup}
							<label class="option" class:on={method === 'abholung'}>
								<input type="radio" name="lieferung" value="abholung" bind:group={method} />
								<span><strong>{i.tr('Abholung', 'Pickup')}</strong><span class="muted small">{[data.pickup.address, data.pickup.note].filter(Boolean).join(' – ')}</span></span>
							</label>
						{/if}
					</div>
					{#if method === 'versand'}
						<label class="check"><input type="checkbox" name="andere_lieferadresse" bind:checked={separate} /><span>{i.tr('An eine andere Adresse liefern', 'Ship to a different address')}</span></label>
						{#if separate}
							<div class="grid-2">
								<label class="field"><span class="label">{i.tr('Vorname', 'First name')} *</span><input class="input" name="lf_vorname" required value={val('lf_vorname')} aria-invalid={bad('lf_vorname')} /></label>
								<label class="field"><span class="label">{i.tr('Nachname', 'Last name')} *</span><input class="input" name="lf_nachname" required value={val('lf_nachname')} aria-invalid={bad('lf_nachname')} /></label>
							</div>
							<label class="field"><span class="label">{i.tr('Firma (optional)', 'Company (optional)')}</span><input class="input" name="lf_firma" value={val('lf_firma')} /></label>
							<label class="field"><span class="label">{i.tr('Straße und Hausnummer', 'Street and number')} *</span><input class="input" name="lf_strasse" required value={val('lf_strasse')} aria-invalid={bad('lf_strasse')} /></label>
							<div class="grid-3">
								<label class="field"><span class="label">{i.tr('PLZ', 'Postcode')} *</span><input class="input" name="lf_plz" required value={val('lf_plz')} aria-invalid={bad('lf_plz')} /></label>
								<label class="field"><span class="label">{i.tr('Ort', 'City')} *</span><input class="input" name="lf_ort" required value={val('lf_ort')} aria-invalid={bad('lf_ort')} /></label>
								<label class="field">
									<span class="label">{i.tr('Land', 'Country')} *</span>
									<select class="select" name="lf_land" bind:value={lfLand}>
										{#each data.shipCountries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
									</select>
								</label>
							</div>
						{/if}
						{#if !shipAllowed}
							<p class="alert alert-error">{i.tr('In dieses Land liefern wir leider nicht. Bitte eine andere Lieferadresse angeben.', "Sorry, we don't ship to this country. Please enter a different shipping address.")}</p>
						{/if}
					{/if}
				</section>
			{/if}

			<!-- Zahlung -->
			<section class="block">
				<h2 class="h3">{i.tr('Zahlung', 'Payment')}</h2>
				{#if totals.amountDue === 0}
					<p class="muted">{i.tr('Deine Bestellung ist komplett mit Gutschein bezahlt.', 'Your order is fully paid by gift card.')}</p>
				{:else if payList.length}
					<div class="options">
						{#each payList as p (p.id)}
							<label class="option" class:on={payment === p.id}>
								<input type="radio" name="zahlung" value={p.id} bind:group={payment} />
								<span><strong>{p.label}</strong><span class="muted small">{methodInfo[p.id]?.[i.locale] ?? ''}</span></span>
							</label>
						{/each}
					</div>
				{:else}
					<p class="alert alert-error">{i.tr('Derzeit ist keine Zahlungsart verfügbar. Bitte kontaktiere uns.', 'No payment method is available right now. Please contact us.')}</p>
				{/if}
			</section>

			<section class="block">
				<label class="field">
					<span class="label">{i.tr('Anmerkung zur Bestellung (optional)', 'Order note (optional)')}</span>
					<textarea class="textarea" name="anmerkung" maxlength="1000">{val('anmerkung')}</textarea>
				</label>
				{#if !data.loggedIn}
					<label class="check"><input type="checkbox" name="konto_anlegen" checked={val('konto_anlegen') === 'on'} /><span>{i.tr('Kundenkonto anlegen – du bekommst einen Link, um es zu bestätigen', "Create an account – we'll send you a link to confirm it")}</span></label>
				{/if}
			</section>
		</div>

		<aside class="summary panel">
			<h2 class="h3">{i.tr('Deine Bestellung', 'Your order')}</h2>
			<ul class="mini">
				{#each data.view.lines as l (l.id)}
					<li>
						<span class="img">{#if l.image}<Picture media={l.image} sizes="80px" want={400} alt="" />{/if}<span class="q">{l.quantity}</span></span>
						<span class="mi">
							<strong>{l.title}</strong>
							<LineDetails config={l.snapshot} variantTitle={l.variantTitle} isDeposit={l.isDeposit} />
						</span>
						<span class="tabular">{i.money(l.lineTotal)}</span>
					</li>
				{/each}
			</ul>
			<Totals t={totals} discountCode={data.view.discountCode} {country} />

			{#if data.view.hasPersonalized}
				<p class="hint">{i.tr('Dekore werden nach deinen Angaben gefertigt. Für personalisierte Waren besteht kein Rücktrittsrecht (§ 18 Abs. 1 Z 3 FAGG).', 'Graphics are made to your specifications. Personalised goods cannot be returned (§ 18 (1) 3 FAGG).')}</p>
			{/if}
			<label class="check">
				<input type="checkbox" name="agb" required aria-invalid={bad('agb')} />
				<span class="small">
					{i.tr('Ich akzeptiere die', 'I accept the')}
					<a class="link" href={i.href('/info/agb')} target="_blank">{i.tr('AGB', 'terms and conditions')}</a>
					{i.tr('und habe die', 'and have read the')}
					<a class="link" href={i.href('/info/widerruf')} target="_blank">{i.tr('Widerrufsbelehrung', 'withdrawal information')}</a>
					{i.tr('und', 'and')}
					<a class="link" href={i.href('/info/datenschutz')} target="_blank">{i.tr('Datenschutzerklärung', 'privacy policy')}</a>
					{i.tr('gelesen.', '.')}
				</span>
			</label>
			{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}
			<button class="btn btn-block" disabled={busy || !shipAllowed || (totals.amountDue > 0 && !payList.length)}>
				{busy ? i.tr('Bestellung wird gesendet …', 'Placing order …') : i.tr('Zahlungspflichtig bestellen', 'Place order and pay')}
			</button>
		</aside>
	</form>
</div>

<style>
	.layout {
		display: grid;
		gap: 2rem;
		margin-top: 2rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
			align-items: start;
			gap: 3rem;
		}
		.summary {
			position: sticky;
			top: calc(var(--header-h) + 1.5rem);
		}
	}
	.steps {
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.block-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}
	.small-select {
		width: auto;
		min-height: 2.5rem;
		font-size: 0.9rem;
	}
	.grid-3 {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 640px) {
		.grid-3 {
			grid-template-columns: 1fr 2fr 1.5fr;
		}
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.option {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
		padding: 1rem;
		background: #18181b;
		box-shadow: inset 0 0 0 1px #27272a;
		cursor: pointer;
	}
	.option.on {
		box-shadow: inset 0 0 0 2px #fff;
	}
	.option input {
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.2rem;
		accent-color: #fff;
	}
	.option > span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.summary {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}
	.mini li {
		display: grid;
		grid-template-columns: 4.5rem 1fr auto;
		gap: 0.75rem;
		padding-block: 0.7rem;
		border-bottom: 1px solid #27272a;
		font-size: 0.9rem;
	}
	.img {
		position: relative;
		aspect-ratio: 3 / 2;
		background: #27272a;
	}
	.img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.q {
		position: absolute;
		top: -0.4rem;
		right: -0.4rem;
		min-width: 1.3rem;
		height: 1.3rem;
		border-radius: 999px;
		background: #fff;
		color: #000;
		font-size: 0.72rem;
		font-weight: 800;
		display: grid;
		place-items: center;
	}
	.mi {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
</style>
