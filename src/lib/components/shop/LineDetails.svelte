<script lang="ts">
	import { getI18n } from '$lib/i18n.svelte';
	import type { LineConfigSnapshot } from '$lib/shop-types';

	/** Gewählte Upgrades, Personalisierung, Bike, Bundle-Inhalt einer Zeile */
	let { config, variantTitle = '', isDeposit = false, files = {} }: { config: LineConfigSnapshot; variantTitle?: string; isDeposit?: boolean; files?: Record<number, { key: string; name: string }> } = $props();
	const i = getI18n();
</script>

<dl class="details">
	{#if variantTitle}<div><dt class="sr-only">{i.tr('Ausführung', 'Option')}</dt><dd>{variantTitle}</dd></div>{/if}
	{#if isDeposit}<div><dd>{i.tr('Anzahlung – wird vom Endpreis abgezogen', 'Deposit – deducted from the final price')}</dd></div>{/if}
	{#each config.upgrades ?? [] as u (u.group)}<div><dt>{u.group}:</dt><dd>{u.option}</dd></div>{/each}
	{#if config.bike}<div><dt>Bike:</dt><dd>{config.bike.brand} {config.bike.model} {config.bike.year}</dd></div>{/if}
	{#each config.fields ?? [] as f (f.key)}<div><dt>{f.label}:</dt><dd class="pre">{f.value}</dd></div>{/each}
	{#each config.files ?? [] as f (f.key)}
		<div>
			<dt>{f.label}:</dt>
			<dd>
				{#each f.fileIds as id, n (id)}{#if files[id]}<a class="link" href="/datei/{files[id].key}" target="_blank" rel="noopener">{files[id].name}</a>{:else}{i.tr(`Datei ${n + 1}`, `File ${n + 1}`)}{/if}{#if n < f.fileIds.length - 1},{' '}{/if}{/each}
			</dd>
		</div>
	{/each}
	{#each config.bundle ?? [] as b (b.title + b.variantTitle)}<div><dd>{b.quantity}× {b.title}{b.variantTitle ? ` (${b.variantTitle})` : ''}</dd></div>{/each}
	{#if config.gift && (config.gift.name || config.gift.email)}<div><dt>{i.tr('Für', 'For')}:</dt><dd>{config.gift.name} {config.gift.email}</dd></div>{/if}
</dl>

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		font-size: 0.85rem;
		color: #a1a1aa;
	}
	.details div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	dt {
		color: #71717a;
	}
	.pre {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
