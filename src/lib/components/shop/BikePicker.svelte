<script lang="ts">
	import { getI18n } from '$lib/i18n.svelte';
	import type { BikeCatalog } from '$lib/server/shop/catalog';

	/**
	 * Marke → Modell → Baujahr. Als eigenes Formular (Bike-Finder) oder als
	 * Teil der Produkt-Konfiguration (name-Präfix gesetzt, freie Eingabe möglich).
	 */
	interface Props {
		catalog: BikeCatalog;
		/** Vorauswahl */
		modelId?: number | null;
		year?: number | string | null;
		/** Feldnamen-Präfix im Konfigurator, z. B. "bike" → bike[brand] … */
		prefix?: string | null;
		/** Freie Eingabe erlauben, wenn Modell nicht in der Liste ist */
		allowCustom?: boolean;
		required?: boolean;
		invalid?: boolean;
		initialBrand?: string;
		initialModel?: string;
	}

	let { catalog, modelId = null, year = null, prefix = null, allowCustom = false, required = false, invalid = false, initialBrand = '', initialModel = '' }: Props = $props();
	const i = getI18n();

	const startModel = catalog.models.find((m) => m.id === modelId) ?? null;
	let brandId = $state<number | 'custom' | ''>(startModel?.brandId ?? (initialBrand ? (catalog.brands.find((b) => b.name === initialBrand)?.id ?? (allowCustom ? 'custom' : '')) : ''));
	let model = $state<number | 'custom' | ''>(startModel?.id ?? (initialModel && brandId === 'custom' ? 'custom' : ''));
	let yearValue = $state(year ? String(year) : '');
	let customBrand = $state(brandId === 'custom' ? initialBrand : '');
	let customModel = $state(model === 'custom' ? initialModel : '');

	const models = $derived(typeof brandId === 'number' ? catalog.models.filter((m) => m.brandId === brandId) : []);
	const chosen = $derived(typeof model === 'number' ? catalog.models.find((m) => m.id === model) : null);
	const thisYear = new Date().getFullYear() + 1;
	const years = $derived.by(() => {
		const from = chosen?.yearFrom ?? 1990;
		const to = chosen?.yearTo ?? thisYear;
		const out: number[] = [];
		for (let y = to; y >= from; y--) out.push(y);
		return out;
	});

	const brandName = $derived(brandId === 'custom' ? customBrand : (catalog.brands.find((b) => b.id === brandId)?.name ?? ''));
	const modelName = $derived(model === 'custom' || brandId === 'custom' ? customModel : (chosen?.name ?? ''));

	$effect(() => {
		// Marke gewechselt → Modell zurücksetzen, wenn es nicht passt
		if (typeof model === 'number' && !models.some((m) => m.id === model)) model = '';
	});

	const n = (k: string) => (prefix ? `${prefix}[${k}]` : k);
	const ids = $props.id();
</script>

<div class="picker">
	<label class="field">
		<span class="label">{i.tr('Marke', 'Brand')}{#if required}<span class="req"> *</span>{/if}</span>
		<select class="select" id="{ids}-brand" bind:value={brandId} aria-invalid={invalid && !brandName} {required}>
			<option value="">{i.tr('Marke wählen', 'Choose brand')}</option>
			{#each catalog.brands as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
			{#if allowCustom}<option value="custom">{i.tr('Andere Marke …', 'Other brand …')}</option>{/if}
		</select>
	</label>
	{#if brandId === 'custom'}
		<label class="field">
			<span class="label">{i.tr('Marke', 'Brand')}</span>
			<input class="input" bind:value={customBrand} maxlength="60" {required} />
		</label>
		<label class="field">
			<span class="label">{i.tr('Modell', 'Model')}</span>
			<input class="input" bind:value={customModel} maxlength="80" placeholder={i.tr('z. B. EXC 300', 'e.g. EXC 300')} {required} />
		</label>
	{:else}
		<label class="field">
			<span class="label">{i.tr('Modell', 'Model')}{#if required}<span class="req"> *</span>{/if}</span>
			<select class="select" bind:value={model} disabled={!brandId} aria-invalid={invalid && !modelName} {required}>
				<option value="">{brandId ? i.tr('Modell wählen', 'Choose model') : i.tr('Erst Marke wählen', 'Choose brand first')}</option>
				{#each models as m (m.id)}<option value={m.id}>{m.name} · {m.yearFrom}–{m.yearTo ?? i.tr('heute', 'today')}{m.category ? ` (${m.category})` : ''}</option>{/each}
				{#if allowCustom && brandId}<option value="custom">{i.tr('Anderes Modell …', 'Other model …')}</option>{/if}
			</select>
		</label>
		{#if model === 'custom'}
			<label class="field">
				<span class="label">{i.tr('Modell', 'Model')}</span>
				<input class="input" bind:value={customModel} maxlength="80" placeholder={i.tr('z. B. EXC 300', 'e.g. EXC 300')} {required} />
			</label>
		{/if}
	{/if}
	<label class="field">
		<span class="label">{i.tr('Baujahr', 'Year')}{#if required}<span class="req"> *</span>{/if}</span>
		{#if model === 'custom' || brandId === 'custom'}
			<input class="input" bind:value={yearValue} inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="2021" {required} />
		{:else}
			<select class="select" bind:value={yearValue} disabled={!chosen} aria-invalid={invalid && !yearValue} {required}>
				<option value="">{chosen ? i.tr('Baujahr wählen', 'Choose year') : '–'}</option>
				{#each years as y (y)}<option value={String(y)}>{y}</option>{/each}
			</select>
		{/if}
	</label>

	{#if prefix}
		<input type="hidden" name={n('brand')} value={brandName} />
		<input type="hidden" name={n('model')} value={modelName} />
		<input type="hidden" name={n('year')} value={yearValue} />
		<input type="hidden" name={n('modelId')} value={typeof model === 'number' ? model : ''} />
	{:else}
		<input type="hidden" name="modell" value={typeof model === 'number' ? model : ''} />
		<input type="hidden" name="jahr" value={yearValue} />
	{/if}
</div>

<style>
	.picker {
		display: grid;
		gap: 0.75rem;
	}
	@media (min-width: 640px) {
		.picker {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			align-items: end;
		}
	}
</style>
