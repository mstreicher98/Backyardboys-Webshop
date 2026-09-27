<script lang="ts">
	import type { LineConfigSnapshot } from '$lib/shop-types';

	/** Konfiguration einer Bestellzeile im Admin (mit Links zu den Dateien) */
	let { config, variantTitle = '', files = {} }: { config: LineConfigSnapshot; variantTitle?: string; files?: Record<number, { key: string; name: string; preview: boolean }> } = $props();
</script>

<dl class="cfg">
	{#if variantTitle}<div><dt>Ausführung</dt><dd>{variantTitle}</dd></div>{/if}
	{#each config.upgrades ?? [] as u (u.group)}<div><dt>{u.group}</dt><dd>{u.option}</dd></div>{/each}
	{#if config.bike}<div><dt>Bike</dt><dd><strong>{config.bike.brand} {config.bike.model} {config.bike.year}</strong></dd></div>{/if}
	{#each config.fields ?? [] as f (f.key)}<div><dt>{f.label}</dt><dd class="pre">{f.value}</dd></div>{/each}
	{#each config.files ?? [] as f (f.key)}
		<div>
			<dt>{f.label}</dt>
			<dd class="thumbs">
				{#each f.fileIds as id (id)}
					{#if files[id]}
						<a href="/datei/{files[id].key}?download=1" title="{files[id].name} herunterladen">
							{#if files[id].preview}<img src="/datei/{files[id].key}?vorschau=1" alt={files[id].name} />{:else}{files[id].name}{/if}
						</a>
					{/if}
				{/each}
			</dd>
		</div>
	{/each}
	{#each config.bundle ?? [] as b (b.title + b.variantTitle)}<div><dt>Enthält</dt><dd>{b.quantity}× {b.title}{b.variantTitle ? ` (${b.variantTitle})` : ''}</dd></div>{/each}
	{#if config.gift}<div><dt>Gutschein für</dt><dd>{config.gift.name} {config.gift.email}{config.gift.message ? ` – „${config.gift.message}“` : ''}</dd></div>{/if}
</dl>

<style>
	.cfg {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.2rem 0.9rem;
		margin-top: 0.4rem;
		font-size: 0.875rem;
	}
	.cfg div {
		display: contents;
	}
	dt {
		color: var(--c-ink-3);
	}
	.pre {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.thumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.thumbs img {
		width: 5rem;
		height: 5rem;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid var(--c-line);
	}
</style>
