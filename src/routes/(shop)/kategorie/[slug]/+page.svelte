<script lang="ts">
	import Listing from '$lib/components/shop/Listing.svelte';
	import Picture from '$lib/components/shop/Picture.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
	const c = $derived(data.category);
</script>

<Seo title={c.name} description={c.tagline} image={c.image ? `/medien/${c.image.file}-800.webp` : null} />

<header class="cat-head" class:has-img={!!c.image}>
	{#if c.image}
		<div class="bg slant"><Picture media={c.image} sizes="100vw" want={1600} eager alt="" /></div>
	{/if}
	<div class="wrap in">
		<nav class="crumbs" aria-label={i.tr('Pfad', 'Breadcrumb')}>
			<a href={i.href('/')}>Shop</a><span aria-hidden="true">/</span>
			{#if data.parent}<a href={i.href(`/kategorie/${data.parent.slug}`)}>{data.parent.name}</a><span aria-hidden="true">/</span>{/if}
			<span>{c.name}</span>
		</nav>
		<h1 class="display h1">{c.name}</h1>
		{#if c.tagline}<p class="lead">{c.tagline}</p>{/if}
		{#if data.children.length}
			<nav class="subs" aria-label={i.tr('Unterkategorien', 'Subcategories')}>
				{#each data.children as ch (ch.slug)}<a href={i.href(`/kategorie/${ch.slug}`)}>{ch.name}</a>{/each}
			</nav>
		{/if}
	</div>
</header>

<div class="wrap section">
	{#if c.descriptionHtml}<div class="prose desc">{@html c.descriptionHtml}</div>{/if}
	<Listing {...data.listing} />
</div>

<style>
	.cat-head {
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid #18181b;
	}
	.cat-head.has-img {
		min-height: 20rem;
		display: flex;
		align-items: flex-end;
	}
	.bg {
		--cut: 5rem;
		position: absolute;
		inset: 0;
	}
	.bg :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.55;
	}
	.bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, #000 5%, transparent 70%);
	}
	.in {
		position: relative;
		z-index: 1;
		width: 100%;
		padding-block: 2rem 2.25rem;
	}
	.lead {
		margin-top: 0.6rem;
	}
	.subs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
	.subs a {
		display: inline-flex;
		align-items: center;
		height: 2.5rem;
		padding: 0 1rem;
		color: #fff;
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		text-decoration: none;
		box-shadow: inset 0 0 0 1px #52525b;
		background: rgb(0 0 0 / 0.4);
	}
	.subs a:hover {
		background: #fff;
		color: #000;
	}
	.desc {
		margin-bottom: 2rem;
	}
</style>
