<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { name, value = $bindable(''), ...rest }: { name: string; value?: string } & Omit<HTMLInputAttributes, 'type' | 'name' | 'value'> = $props();
	let visible = $state(false);
</script>

<span class="pw">
	<input class="input" {name} type={visible ? 'text' : 'password'} bind:value spellcheck="false" autocapitalize="none" {...rest} />
	<button type="button" onclick={() => (visible = !visible)} aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'} tabindex="-1">
		{#if visible}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
	</button>
</span>

<style>
	.pw {
		position: relative;
		display: block;
	}
	.pw :global(.input) {
		padding-right: 2.75rem;
	}
	button {
		position: absolute;
		right: 0.3rem;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 6px;
		color: var(--c-ink-3);
	}
	button:hover {
		color: var(--c-ink);
		background: var(--c-surface-3);
	}
</style>
