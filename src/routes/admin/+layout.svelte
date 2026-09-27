<script lang="ts">
	import '$lib/admin.css';
	import Toaster from '$lib/components/admin/Toaster.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="manifest" href="/admin.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="BYB Intern" />
</svelte:head>

<div class="adm">
	{@render children()}
</div>
<Toaster />
