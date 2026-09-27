<script lang="ts">
	import { page } from '$app/state';
	import { getI18n } from '$lib/i18n.svelte';

	const i = getI18n();
</script>

<svelte:head><title>{page.status === 404 ? i.tr('Nicht gefunden', 'Not found') : i.tr('Fehler', 'Error')} | Backyardboys Design</title></svelte:head>

<div class="wrap page-top section err">
	<p class="code display">{page.status}</p>
	<h1 class="h3">{page.error?.message}</h1>
	<div class="row">
		<a class="btn" href={i.href('/')}>{i.tr('Zur Startseite', 'Home')}</a>
		<a class="btn btn-ghost" href={i.href('/produkte')}>{i.tr('Alle Produkte', 'All products')}</a>
	</div>
</div>

<style>
	.err {
		min-height: 50vh;
	}
	.code {
		font-size: clamp(4rem, 10vw, 8rem);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2rem;
	}
</style>
