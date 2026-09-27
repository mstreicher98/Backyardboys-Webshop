<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let { page, pages, href }: { page: number; pages: number; href: (p: number) => string } = $props();

	/** 1 … 4 5 [6] 7 8 … 20 */
	const list = $derived.by(() => {
		const out: (number | null)[] = [];
		for (let p = 1; p <= pages; p++) {
			if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
			else if (out[out.length - 1] !== null) out.push(null);
		}
		return out;
	});
</script>

{#if pages > 1}
	<nav class="pager" aria-label="Seiten">
		{#if page > 1}
			<a href={href(page - 1)} class="step" rel="prev"><ChevronLeft size={18} /> Neuer</a>
		{/if}
		<ol>
			{#each list as p, i (i)}
				<li>
					{#if p === null}
						<span class="gap">…</span>
					{:else}
						<a href={href(p)} class="num" aria-current={p === page ? 'page' : undefined}>{p}</a>
					{/if}
				</li>
			{/each}
		</ol>
		{#if page < pages}
			<a href={href(page + 1)} class="step" rel="next">Älter <ChevronRight size={18} /></a>
		{/if}
	</nav>
{/if}

<style>
	.pager {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 3rem;
	}
	ol {
		display: flex;
		gap: 0.25rem;
	}
	a,
	.gap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		min-width: 2.6rem;
		height: 2.6rem;
		padding: 0 0.6rem;
		border-radius: 8px;
		font-weight: 600;
		color: var(--c-ink);
		text-decoration: none;
		font-variant-numeric: tabular-nums;
	}
	a:hover {
		background: var(--c-surface-3);
	}
	.num[aria-current='page'] {
		background: var(--grad);
		color: #fff;
	}
	.gap {
		min-width: 1.5rem;
		color: var(--c-ink-3);
	}
</style>
