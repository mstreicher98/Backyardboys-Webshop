<script lang="ts">
	import { formatDayShort, formatNumber, weekdayShort } from '$lib/format';

	/** Seitenaufrufe je Tag als Säulen – eine Reihe im Akzentverlauf */
	let { data }: { data: { day: string; n: number }[] } = $props();
	const uid = $props.id();

	let width = $state(600);
	const height = 190;
	const pad = { top: 12, right: 4, bottom: 24, left: 36 };

	const max = $derived(Math.max(...data.map((d) => d.n), 0));
	/** Glatte Obergrenze: 0 / 5 / 10 / 20 / 50 / 100 … */
	const top = $derived.by(() => {
		if (max <= 4) return 4;
		const mag = 10 ** Math.floor(Math.log10(max));
		for (const f of [1, 2, 2.5, 5, 10]) if (f * mag >= max) return f * mag;
		return 10 * mag;
	});
	const ticks = $derived([0, top / 2, top]);
	const plotW = $derived(Math.max(10, width - pad.left - pad.right));
	const plotH = height - pad.top - pad.bottom;
	const slot = $derived(plotW / Math.max(1, data.length));
	const barW = $derived(Math.max(2, Math.min(24, slot - 2)));
	const y = (v: number) => pad.top + plotH - (v / top) * plotH;

	/** Säule mit 4px runder Oberkante, unten gerade auf der Grundlinie */
	function bar(i: number, v: number): string {
		const x = pad.left + i * slot + (slot - barW) / 2;
		const h = (v / top) * plotH;
		if (h <= 0) return '';
		const r = Math.min(4, barW / 2, h);
		const b = pad.top + plotH;
		const t = b - h;
		return `M${x},${b} V${t + r} Q${x},${t} ${x + r},${t} H${x + barW - r} Q${x + barW},${t} ${x + barW},${t + r} V${b} Z`;
	}

	let hover = $state<number | null>(null);
	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const i = Math.floor((e.clientX - rect.left - pad.left) / slot);
		hover = i >= 0 && i < data.length ? i : null;
	}
	const tipX = $derived(hover == null ? 0 : pad.left + hover * slot + slot / 2);
</script>

<div class="chart" bind:clientWidth={width}>
	<svg {width} {height} role="img" aria-label="Seitenaufrufe der letzten {data.length} Tage" onpointermove={onMove} onpointerleave={() => (hover = null)}>
		<defs>
			<linearGradient id="{uid}-g" x1="0" y1="1" x2="0" y2="0">
				<stop offset="0" stop-color="#7950f2" />
				<stop offset="1" stop-color="#be4bdb" />
			</linearGradient>
		</defs>
		{#each ticks as t (t)}
			<line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} class="grid" />
			<text x={pad.left - 8} y={y(t)} class="tick" text-anchor="end" dominant-baseline="middle">{formatNumber(t)}</text>
		{/each}
		{#each data as d, i (d.day)}
			<path d={bar(i, d.n)} class="bar" class:dim={hover != null && hover !== i} fill="url(#{uid}-g)" style="--i: {i}" />
			{#if i === 0 || i === data.length - 1 || i % 7 === 0}
				<text x={pad.left + i * slot + slot / 2} y={height - 6} class="tick" text-anchor="middle">{d.day.slice(8, 10)}.{d.day.slice(5, 7)}.</text>
			{/if}
		{/each}
	</svg>
	{#if hover != null}
		{@const d = data[hover]}
		<div class="tip" style:left="{Math.min(Math.max(tipX, 70), width - 70)}px">
			<strong>{formatNumber(d.n)}</strong> {d.n === 1 ? 'Aufruf' : 'Aufrufe'}
			<span>{weekdayShort(d.day)}, {formatDayShort(d.day)}</span>
		</div>
	{/if}
</div>

<details class="as-table">
	<summary>Als Tabelle anzeigen</summary>
	<table class="table">
		<thead><tr><th>Tag</th><th>Aufrufe</th></tr></thead>
		<tbody>
			{#each [...data].reverse() as d (d.day)}
				<tr><td>{formatDayShort(d.day)}</td><td class="tabular">{formatNumber(d.n)}</td></tr>
			{/each}
		</tbody>
	</table>
</details>

<style>
	.chart {
		position: relative;
		width: 100%;
		/* bis die Breite gemessen ist, hat das Diagramm 600 px – nicht über den Rand ragen lassen */
		overflow: hidden;
	}
	svg {
		display: block;
		touch-action: pan-y;
	}
	.grid {
		stroke: var(--c-line);
		stroke-width: 1;
	}
	.tick {
		fill: var(--c-ink-3);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	/* Säulen wachsen beim Laden nacheinander aus der Grundlinie */
	.bar {
		transition: opacity 120ms;
		transform-box: fill-box;
		transform-origin: bottom;
		animation: grow 700ms var(--ease-out) both;
		animation-delay: calc(var(--i) * 12ms);
	}
	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}
	.bar.dim {
		opacity: 0.35;
	}
	.tip {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.35rem 0.6rem;
		border-radius: 8px;
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		box-shadow: var(--shadow-pop);
		font-size: 0.8rem;
		color: var(--c-ink-2);
		white-space: nowrap;
		pointer-events: none;
	}
	.tip strong {
		font-size: 1rem;
		color: var(--c-ink);
	}
	.tip span {
		color: var(--c-ink-3);
	}
	.as-table {
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}
	.as-table summary {
		cursor: pointer;
		color: var(--c-ink-3);
	}
	.as-table table {
		margin-top: 0.5rem;
		max-width: 20rem;
	}
</style>
