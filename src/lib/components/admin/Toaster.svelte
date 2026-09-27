<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { toasts } from '$lib/toast.svelte';
</script>

<div class="toaster" role="status" aria-live="polite">
	{#each toasts.list as t (t.id)}
		<div class="toast" data-kind={t.kind} transition:fly={{ y: 16, duration: 200 }}>
			{#if t.kind === 'ok'}<CircleCheck size={19} />{:else}<CircleAlert size={19} />{/if}
			<span>{t.message}</span>
			<button type="button" onclick={() => toasts.dismiss(t.id)} aria-label="Meldung schließen"><X size={16} /></button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		z-index: 90;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(26rem, calc(100vw - 2rem));
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 0.75rem 0.75rem 1rem;
		border-radius: 12px;
		background: var(--c-ink);
		color: #fff;
		box-shadow: var(--shadow-pop);
		font-weight: 550;
		pointer-events: auto;
	}
	.toast[data-kind='ok'] :global(svg:first-child) {
		color: #6fd3a2;
	}
	.toast[data-kind='error'] {
		background: #8c1d15;
	}
	span {
		flex: 1;
	}
	button {
		display: grid;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 6px;
		color: rgb(255 255 255 / 0.7);
	}
	button:hover {
		background: rgb(255 255 255 / 0.12);
		color: #fff;
	}
</style>
