<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import Check from '@lucide/svelte/icons/check';
	import BikePicker from '$lib/components/shop/BikePicker.svelte';
	import FileField from '$lib/components/shop/FileField.svelte';
	import Picture from '$lib/components/shop/Picture.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { cartUi } from '$lib/cart-ui.svelte';
	import { getI18n } from '$lib/i18n.svelte';
	import { mediaSrc } from '$lib/media';
	import type { UploadedFile } from '$lib/shop-types';
	import { htmlText } from '$lib/text';

	let { data, form } = $props();
	const i = getI18n();
	const p = $derived(data.product);
	const isDeposit = $derived(p.dekorType === 'full_custom');

	/* ---------------- Bilder */
	let shown = $state(0);
	$effect.pre(() => {
		void data.product.id;
		shown = 0;
	});

	/* ---------------- Varianten */
	// Startauswahl schon beim Server-Rendern setzen (sonst zeigt die Seite ohne JavaScript 0 € / ausverkauft);
	// beim Wechsel auf ein anderes Produkt (gleiche Komponente) neu setzen
	const startValues = () => [...((data.variants.find((v) => v.limit !== 0) ?? data.variants[0])?.values ?? [])];
	const startUpgrades = () => Object.fromEntries(data.upgrades.map((g) => [g.id, (g.options.find((o) => o.isDefault) ?? g.options[0])?.id]));
	let selected = $state<string[]>(startValues());
	let shownProduct = data.product.id;
	$effect.pre(() => {
		if (data.product.id === shownProduct) return;
		shownProduct = data.product.id;
		selected = startValues();
		upgrades = startUpgrades();
		fieldValues = {};
		fileLists = {};
	});
	const variant = $derived(data.options.length ? data.variants.find((v) => v.values.every((val, n) => val === selected[n])) : data.variants[0]);
	/** Gibt es mit diesem Wert (und den übrigen Auswahlen) eine bestellbare Variante? */
	function possible(optIndex: number, value: string) {
		return data.variants.some((v) => v.values[optIndex] === value && v.limit !== 0 && v.values.every((val, n) => n === optIndex || n > optIndex || val === selected[n]));
	}

	/* ---------------- Upgrades, Felder */
	let upgrades = $state<Record<number, number>>(startUpgrades());
	let fieldValues = $state<Record<string, string>>({});
	let fileLists = $state<Record<string, UploadedFile[]>>({});

	const surcharges = $derived(
		data.upgrades.reduce((a, g) => a + (g.options.find((o) => o.id === upgrades[g.id])?.surcharge ?? 0), 0) +
			data.fields.reduce((a, f) => a + (f.surcharge && (f.type === 'datei' ? (fileLists[f.key]?.length ?? 0) > 0 : (fieldValues[f.key] ?? '').trim()) ? f.surcharge : 0), 0)
	);
	const unit = $derived((variant?.price ?? 0) + (isDeposit ? 0 : surcharges));
	let qty = $state(1);
	const soldOut = $derived(!variant || variant.limit === 0);
	const fixedQty = $derived(p.kind === 'dekor' || p.kind === 'gutschein');

	let busy = $state(false);
	let added = $state(false);
	const errors = $derived(((form as { errors?: Record<string, string> } | null)?.errors ?? {}) as Record<string, string>);

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: p.title,
			description: htmlText(p.descriptionHtml).slice(0, 500),
			image: data.images.map((m) => `${page.url.origin}${mediaSrc(m, 1200)}`),
			brand: { '@type': 'Brand', name: 'Backyardboys Design' },
			offers: data.variants.map((v) => ({
				'@type': 'Offer',
				price: (v.listPrice / 100).toFixed(2),
				priceCurrency: 'EUR',
				availability: v.limit === 0 ? 'https://schema.org/OutOfStock' : p.releaseDate ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock',
				url: page.url.href
			}))
		}).replace(/</g, '\\u003c')
	);
	const surchargeText = (n: number) => (n > 0 ? (isDeposit ? i.tr(`+ ${i.money(n)} im Endpreis`, `+ ${i.money(n)} in final price`) : `+ ${i.money(n)}`) : i.tr('inklusive', 'included'));
</script>

<Seo title={p.title} description={p.subtitle || htmlText(p.descriptionHtml).slice(0, 180)} image={data.images[0] ? mediaSrc(data.images[0], 1200) : null} type="product" noindex={p.status !== 'aktiv'} />
<svelte:head>{@html `<script type="application/ld+json">${jsonLd}</script>`}</svelte:head>

<div class="wrap page-top">
	{#if p.status !== 'aktiv'}<p class="alert alert-info draft">{i.tr('Vorschau: Dieses Produkt ist noch nicht veröffentlicht.', 'Preview: this product is not published yet.')}</p>{/if}

	<div class="layout">
		<div class="gallery">
			<div class="main-img">
				{#if data.images[shown]}
					<Picture media={data.images[shown]} sizes="(min-width: 1024px) 55vw, 100vw" want={1600} eager />
				{:else}
					<span class="ph" aria-hidden="true">BYB</span>
				{/if}
			</div>
			{#if data.images.length > 1}
				<div class="thumbs" role="group" aria-label={i.tr('Bilder', 'Images')}>
					{#each data.images as m, n (m.id)}
						<button type="button" class="thumb" aria-pressed={n === shown} aria-label={i.tr(`Bild ${n + 1}`, `Image ${n + 1}`)} onclick={() => (shown = n)}>
							<Picture media={m} sizes="120px" want={400} alt="" />
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="info">
			<h1 class="display title">{p.title}</h1>
			{#if p.subtitle}<p class="sub">{p.subtitle}</p>{/if}

			<div class="price-block">
				{#if isDeposit}<span class="price-label">{i.tr('Anzahlung', 'Deposit')}</span>{/if}
				<span class="price tabular">{i.money(unit * (fixedQty ? 1 : 1))}</span>
				{#if variant?.compareAt && variant.compareAt > variant.price}<s class="muted">{i.money(variant.compareAt + surcharges)}</s>{/if}
				{#if data.dealer}<span class="badge">{i.tr('Händlerpreis', 'Dealer price')}</span>{/if}
			</div>
			<p class="muted small">
				{page.data.taxMode === 'kleinunternehmer' ? i.tr('Endpreis, keine USt. (Kleinunternehmer)', 'Final price, no VAT (small business)') : i.tr('inkl. USt.', 'incl. VAT')},
				<a class="link" href={i.href('/info/versand')}>{i.tr('zzgl. Versand', 'plus shipping')}</a>
			</p>

			<div class="facts">
				{#if p.releaseDate}<span class="badge">{i.tr(`Vorbestellung · ab ${i.date(p.releaseDate)}`, `Pre-order · from ${i.date(p.releaseDate)}`)}</span>{/if}
				{#if variant && variant.limit != null && variant.limit > 0 && variant.limit <= 5}<span class="badge badge-dark">{i.tr(`Nur noch ${variant.limit} Stück`, `Only ${variant.limit} left`)}</span>{/if}
				{#if p.leadTime}<span class="muted small">{i.tr('Lieferzeit', 'Delivery time')}: {p.leadTime}</span>{/if}
			</div>

			{#if isDeposit}
				<div class="deposit">
					<p><strong>{i.tr('So funktioniert Full Custom', 'How full custom works')}</strong></p>
					<ol>
						<li>{i.tr('Du beschreibst dein Bike und dein Wunschdesign und zahlst die Anzahlung.', 'Describe your bike and your dream design and pay the deposit.')}</li>
						<li>{i.tr('Wir schicken dir den Entwurf – du gibst frei oder wünschst Änderungen.', "We send you the design – approve it or ask for changes.")}</li>
						<li>{i.tr('Nach der Freigabe zahlst du den Rest (Endpreis minus Anzahlung), dann drucken wir.', 'After approval you pay the rest (final price minus deposit), then we print.')}</li>
					</ol>
				</div>
			{/if}

			<form
				method="POST"
				action="?/add"
				class="config"
				use:enhance={() => {
					busy = true;
					added = false;
					return async ({ result, update }) => {
						busy = false;
						if (result.type === 'success') {
							added = true;
							await invalidateAll();
							cartUi.open = true;
						} else {
							await update({ reset: false });
						}
					};
				}}
			>
				<input type="hidden" name="variante" value={variant?.id ?? ''} />

				{#each data.options as opt, n (opt.name)}
					<fieldset class="group">
						<legend class="label">{opt.name}{#if selected[n]}: <span class="muted">{opt.values.find((v) => v.value === selected[n])?.label}</span>{/if}</legend>
						<div class="chips">
							{#each opt.values as v (v.value)}
								<label class="chip">
									<input type="radio" name="opt-{n}" value={v.value} bind:group={selected[n]} disabled={!possible(n, v.value) && selected[n] !== v.value} />
									<span>{v.label}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/each}

				{#each data.upgrades as g (g.id)}
					<fieldset class="group">
						<legend class="label">{g.name}</legend>
						<div class="swatches">
							{#each g.options as o (o.id)}
								<label class="swatch" class:holo-ring={upgrades[g.id] === o.id}>
									<input type="radio" name="upgrades[{g.id}]" value={o.id} bind:group={upgrades[g.id]} />
									<span class="sw-img">{#if o.image}<Picture media={o.image} sizes="140px" want={400} alt="" />{/if}</span>
									<span class="sw-name">{o.name}</span>
									<span class="sw-price">{surchargeText(o.surcharge)}</span>
									{#if upgrades[g.id] === o.id}<span class="sw-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>{/if}
								</label>
							{/each}
						</div>
					</fieldset>
				{/each}

				{#each data.bundle as b (b.id)}
					{#if b.variants.length > 1}
						<label class="field">
							<span class="label">{b.quantity > 1 ? `${b.quantity}× ` : ''}{b.title}</span>
							<select class="select" name="bundle[{b.id}]" required aria-invalid={!!errors[`bundle_${b.id}`]}>
								<option value="">{i.tr('Bitte wählen', 'Please choose')}</option>
								{#each b.variants as v (v.id)}<option value={v.id} disabled={v.soldOut}>{v.label}{v.soldOut ? ` – ${i.tr('ausverkauft', 'sold out')}` : ''}</option>{/each}
							</select>
						</label>
					{:else}
						<p class="small muted">{b.quantity}× {b.title}</p>
					{/if}
				{/each}

				{#each data.fields as f (f.key)}
					{#if f.type === 'bike' && data.bikes}
						<fieldset class="group">
							<legend class="label">{f.label}{#if f.required}<span class="req"> *</span>{/if}</legend>
							{#if f.help}<p class="hint">{f.help}</p>{/if}
							<BikePicker catalog={data.bikes} prefix="bike" allowCustom required={f.required} invalid={!!errors[f.key]} modelId={data.savedBike?.modelId} year={data.savedBike?.year} />
							{#if errors[f.key]}<p class="error-text">{errors[f.key]}</p>{/if}
						</fieldset>
					{:else if f.type === 'datei'}
						<div>
							<FileField name="files[{f.key}]" label={f.label + (f.surcharge ? ` (${surchargeText(f.surcharge)})` : '')} help={f.help} required={f.required} max={f.maxFiles} invalid={!!errors[f.key]} bind:files={() => fileLists[f.key] ?? [], (v) => (fileLists[f.key] = v)} />
							{#if errors[f.key]}<p class="error-text">{errors[f.key]}</p>{/if}
						</div>
					{:else}
						<label class="field">
							<span class="label">{f.label}{#if f.surcharge}<span class="muted"> ({surchargeText(f.surcharge)})</span>{/if}{#if f.required}<span class="req"> *</span>{/if}</span>
							{#if f.help}<span class="hint">{f.help}</span>{/if}
							{#if f.type === 'textarea'}
								<textarea class="textarea" name="fields[{f.key}]" placeholder={f.placeholder} maxlength={f.maxLength || 2000} required={f.required} aria-invalid={!!errors[f.key]} bind:value={fieldValues[f.key]}></textarea>
							{:else if f.type === 'select'}
								<select class="select" name="fields[{f.key}]" required={f.required} aria-invalid={!!errors[f.key]} bind:value={fieldValues[f.key]}>
									<option value="">{i.tr('Bitte wählen', 'Please choose')}</option>
									{#each f.choices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
								</select>
							{:else}
								<input class="input" name="fields[{f.key}]" type="text" inputmode={f.type === 'number' ? 'decimal' : undefined} placeholder={f.placeholder} maxlength={f.maxLength || 120} required={f.required} aria-invalid={!!errors[f.key]} bind:value={fieldValues[f.key]} />
							{/if}
							{#if errors[f.key]}<span class="error-text">{errors[f.key]}</span>{/if}
						</label>
					{/if}
				{/each}

				{#if p.kind === 'gutschein'}
					<fieldset class="group">
						<legend class="label">{i.tr('Direkt verschenken (optional)', 'Send as a gift (optional)')}</legend>
						<p class="hint">{i.tr('Leer lassen, dann schicken wir den Gutschein an dich.', "Leave empty and we'll send the gift card to you.")}</p>
						<div class="grid-2">
							<label class="field"><span class="label">{i.tr('Name', 'Name')}</span><input class="input" name="gift[name]" maxlength="80" /></label>
							<label class="field"><span class="label">{i.tr('E-Mail', 'Email')}</span><input class="input" name="gift[email]" type="email" maxlength="200" aria-invalid={!!errors.gift} /></label>
						</div>
						<label class="field"><span class="label">{i.tr('Nachricht', 'Message')}</span><textarea class="textarea" name="gift[message]" maxlength="500"></textarea></label>
					</fieldset>
				{/if}

				{#if form?.error}<p class="alert alert-error" role="alert">{form.error}</p>{/if}

				<div class="buy">
					{#if !fixedQty}
						<label class="qty">
							<span class="sr-only">{i.tr('Menge', 'Quantity')}</span>
							<button type="button" onclick={() => (qty = Math.max(1, qty - 1))} aria-label={i.tr('Weniger', 'Less')}>−</button>
							<input name="menge" type="number" min="1" max={variant?.limit ?? 99} bind:value={qty} inputmode="numeric" />
							<button type="button" onclick={() => (qty = Math.min(variant?.limit ?? 99, qty + 1))} aria-label={i.tr('Mehr', 'More')}>+</button>
						</label>
					{:else}
						<input type="hidden" name="menge" value="1" />
					{/if}
					<button class="btn add" disabled={busy || soldOut || p.status !== 'aktiv'}>
						{#if soldOut}
							{i.tr('Ausverkauft', 'Sold out')}
						{:else if busy}
							{i.tr('Wird hinzugefügt …', 'Adding …')}
						{:else if isDeposit}
							{i.tr('Anzahlung in den Warenkorb', 'Add deposit to cart')}
						{:else if p.releaseDate}
							{i.tr('Vorbestellen', 'Pre-order')}
						{:else}
							{i.tr('In den Warenkorb', 'Add to cart')}
						{/if}
					</button>
				</div>
				{#if added}<p class="alert alert-ok" role="status">{i.tr('Im Warenkorb.', 'Added to cart.')} <a class="link" href={i.href('/kasse')}>{i.tr('Zur Kasse', 'Checkout')}</a></p>{/if}
				{#if p.kind === 'dekor'}
					<p class="hint">{i.tr('Dekore werden nach deinen Angaben gefertigt und sind vom Rücktrittsrecht ausgenommen.', 'Graphics are made to your specifications and cannot be returned.')}</p>
				{/if}
			</form>
		</div>
	</div>

	{#if p.descriptionHtml || data.fits.length}
		<section class="details">
			{#if p.descriptionHtml}
				<div>
					<h2 class="display h2">{i.tr('Details', 'Details')}</h2>
					<div class="prose">{@html p.descriptionHtml}</div>
				</div>
			{/if}
			{#if data.fits.length || p.universalFit}
				<div>
					<h2 class="h3">{i.tr('Passt für', 'Fits')}</h2>
					{#if p.universalFit}
						<p class="muted">{i.tr('Jedes Bike – wir gestalten passend für dein Modell.', 'Any bike – we design to fit your model.')}</p>
					{:else}
						<ul class="fits">
							{#each data.fits as f (f.label + f.years)}<li><span>{f.label}</span><span class="muted tabular">{f.years}</span></li>{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</section>
	{/if}

	{#if data.related.length}
		<section class="section">
			<h2 class="display h2">{i.tr('Passt dazu', 'You might also like')}</h2>
			<div class="related">
				{#each data.related as r (r.id)}<ProductCard p={r} />{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.draft {
		margin-bottom: 1rem;
	}
	.layout {
		display: grid;
		gap: 2rem;
	}
	@media (min-width: 1024px) {
		.layout {
			grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
			gap: 3.5rem;
			align-items: start;
		}
		.gallery {
			position: sticky;
			top: calc(var(--header-h) + 1.5rem);
		}
	}
	.main-img {
		position: relative;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
		clip-path: polygon(0 0, 100% 0, 100% calc(100% - 2.5rem), calc(100% - 2.5rem) 100%, 0 100%);
	}
	.main-img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.ph {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 3rem;
		font-weight: 850;
		font-stretch: 125%;
		color: #3f3f46;
	}
	.thumbs {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.6rem;
		overflow-x: auto;
	}
	.thumb {
		flex: 0 0 5.5rem;
		aspect-ratio: 3 / 2;
		background: #18181b;
		overflow: hidden;
		opacity: 0.55;
		box-shadow: inset 0 0 0 2px transparent;
	}
	.thumb[aria-pressed='true'] {
		opacity: 1;
		outline: 2px solid #fff;
		outline-offset: -2px;
	}
	.thumb :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.title {
		font-size: clamp(1.75rem, 1.2rem + 2.2vw, 2.9rem);
	}
	.sub {
		margin-top: 0.5rem;
		color: #d4d4d8;
		font-size: 1.05rem;
	}
	.price-block {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
		margin-top: 1.25rem;
	}
	.price-label {
		font-weight: 650;
		color: #a1a1aa;
	}
	.price {
		font-size: 1.9rem;
		font-weight: 800;
		font-stretch: 110%;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
		margin-top: 0.9rem;
	}
	.deposit {
		margin-top: 1.5rem;
		padding: 1.1rem 1.25rem;
		background: #18181b;
		border-left: 3px solid #fff;
	}
	.deposit ol {
		margin-top: 0.5rem;
		padding-left: 1.2rem;
		list-style: decimal;
		color: #d4d4d8;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.config {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-top: 1.75rem;
		padding-top: 1.75rem;
		border-top: 1px solid #27272a;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 0;
		padding: 0;
		margin: 0;
	}
	.group legend {
		margin-bottom: 0.6rem;
	}
	.swatches {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.swatch {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem;
		background: #18181b;
		cursor: pointer;
		box-shadow: inset 0 0 0 1px #27272a;
	}
	.swatch:hover {
		box-shadow: inset 0 0 0 1px #71717a;
	}
	.swatch input {
		position: absolute;
		opacity: 0;
	}
	.swatch:has(input:focus-visible) {
		outline: 2.5px solid var(--c-focus);
		outline-offset: 3px;
	}
	.sw-img {
		display: block;
		aspect-ratio: 1;
		background: #27272a;
		overflow: hidden;
	}
	.sw-img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.sw-name {
		font-size: 0.85rem;
		font-weight: 700;
		line-height: 1.2;
	}
	.sw-price {
		font-size: 0.8rem;
		color: #a1a1aa;
	}
	.sw-check {
		position: absolute;
		top: 0.9rem;
		right: 0.9rem;
		display: grid;
		place-items: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 999px;
		background: #fff;
		color: #000;
	}
	.buy {
		display: flex;
		gap: 0.75rem;
		align-items: stretch;
	}
	.add {
		flex: 1;
	}
	.qty {
		display: flex;
		align-items: stretch;
		box-shadow: inset 0 0 0 1px #3f3f46;
	}
	.qty button {
		width: 2.6rem;
		font-size: 1.2rem;
		color: #fff;
	}
	.qty button:hover {
		background: #18181b;
	}
	.qty input {
		width: 3rem;
		background: transparent;
		border: 0;
		color: #fff;
		text-align: center;
		font-weight: 700;
		font-size: 1rem;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.qty input::-webkit-inner-spin-button {
		-webkit-appearance: none;
	}
	.details {
		display: grid;
		gap: 2.5rem;
		margin-top: 4rem;
		padding-top: 3rem;
		border-top: 1px solid #18181b;
	}
	@media (min-width: 1024px) {
		.details {
			grid-template-columns: 1.6fr 1fr;
		}
	}
	.details .h2 {
		margin-bottom: 1rem;
	}
	.fits {
		margin-top: 0.75rem;
	}
	.fits li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid #18181b;
	}
	.related {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.75rem 1rem;
		margin-top: 1.75rem;
	}
	@media (min-width: 1024px) {
		.related {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2rem 1.5rem;
		}
	}
</style>
