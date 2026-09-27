<script lang="ts">
	let { children } = $props();
</script>

<div class="auth">
	<div class="box">
		<div class="brand">
			<span class="logo"><img src="/bilder/logo.webp" alt="Backyardboys Design" width="600" height="254" /></span>
			<span class="big">Interner Bereich</span>
		</div>
		{@render children()}
	</div>
</div>

<style>
	.auth {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		background:
			linear-gradient(to bottom, #000 0 13rem, transparent 13rem),
			var(--c-bg);
	}
	.box {
		width: 100%;
		max-width: 26rem;
		padding: 1.75rem;
		border-radius: 14px;
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		box-shadow: var(--shadow-pop);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-bottom: 1.5rem;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 4.2rem;
		height: 2.9rem;
		padding: 0.45rem;
		border-radius: 8px;
		background: #000;
	}
	.logo img {
		width: 100%;
		height: auto;
	}
	.big {
		font-size: 1.35rem;
		font-weight: 800;
		font-stretch: 112%;
		text-transform: uppercase;
		line-height: 1.05;
	}
</style>
