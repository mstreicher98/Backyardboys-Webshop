<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Menu from '@lucide/svelte/icons/menu';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import UserRound from '@lucide/svelte/icons/user-round';
	import X from '@lucide/svelte/icons/x';
	import Bike from '@lucide/svelte/icons/bike';
	import { getI18n, switchLocalePath } from '$lib/i18n.svelte';
	import type { CategoryNode } from '$lib/server/shop/catalog';
	import Picture from './Picture.svelte';

	interface Props {
		menu: CategoryNode[];
		cartCount: number;
		loggedIn: boolean;
		bike: { label: string } | null;
		onCart: () => void;
	}

	let { menu, cartCount, loggedIn, bike, onCart }: Props = $props();
	const i = getI18n();

	let open = $state<number | null>(null);
	let drawer = $state(false);
	let searching = $state(false);
	let expanded = $state<number | null>(null);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	afterNavigate(() => {
		open = null;
		drawer = false;
		searching = false;
	});

	function enter(id: number) {
		if (closeTimer) clearTimeout(closeTimer);
		open = id;
	}
	function leave() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = setTimeout(() => (open = null), 160);
	}

	const other = $derived(i.locale === 'de' ? 'en' : 'de');
	const switchHref = $derived(switchLocalePath(page.url.pathname, page.url.search, other));
	const current = $derived(menu.find((m) => m.id === open) ?? null);

	function focusSearch(node: HTMLInputElement) {
		node.focus();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			open = null;
			searching = false;
			drawer = false;
		}
	}}
/>

<header class="head">
	<div class="bar wrap">
		<button type="button" class="icon-btn only-mobile" aria-label={i.tr('Menü öffnen', 'Open menu')} onclick={() => (drawer = true)}><Menu size={24} /></button>

		<a href={i.href('/')} class="logo" aria-label="Backyardboys Design – {i.tr('Startseite', 'Home')}">
			<img src="/bilder/logo.webp" alt="" width="600" height="254" />
		</a>

		<nav class="nav only-desktop" aria-label={i.tr('Hauptmenü', 'Main menu')}>
			{#each menu as item (item.id)}
				{#if item.children.length}
					<div class="nav-item" role="presentation" onmouseenter={() => enter(item.id)} onmouseleave={leave}>
						<button type="button" class="nav-link" aria-expanded={open === item.id} aria-controls="mega" onclick={() => (open = open === item.id ? null : item.id)}>
							{item.name}
							<ChevronDown size={15} />
						</button>
					</div>
				{:else}
					<a class="nav-link" href={i.href(`/kategorie/${item.slug}`)}>{item.name}</a>
				{/if}
			{/each}
		</nav>

		<div class="tools">
			<button type="button" class="icon-btn only-desktop" aria-label={i.tr('Suchen', 'Search')} onclick={() => (searching = !searching)}><Search size={21} /></button>
			<a href={i.href('/bike-finder')} class="bike only-desktop" title={i.tr('Bike-Finder', 'Bike finder')}>
				<Bike size={21} />
				<span>{bike ? bike.label : i.tr('Mein Bike', 'My bike')}</span>
			</a>
			<a href={switchHref} class="lang only-desktop" hreflang={other} lang={other} aria-label={other === 'en' ? 'English' : 'Deutsch'}>{other.toUpperCase()}</a>
			<a href={i.href('/konto')} class="icon-btn" aria-label={loggedIn ? i.tr('Mein Konto', 'My account') : i.tr('Anmelden', 'Log in')}><UserRound size={22} /></a>
			<button type="button" class="icon-btn cart" aria-label={i.tr(`Warenkorb, ${cartCount} Artikel`, `Cart, ${cartCount} items`)} onclick={onCart}>
				<ShoppingBag size={22} />
				{#if cartCount > 0}<span class="count">{cartCount > 99 ? '99+' : cartCount}</span>{/if}
			</button>
		</div>
	</div>

	{#if searching}
		<form class="search wrap" action={i.href('/produkte')} method="GET" role="search">
			<Search size={20} />
			<input use:focusSearch name="q" type="search" placeholder={i.tr('Dekor, Shirt, Modell …', 'Graphics, shirt, model …')} aria-label={i.tr('Suchbegriff', 'Search term')} />
			<button class="btn btn-sm">{i.tr('Suchen', 'Search')}</button>
		</form>
	{/if}

	{#if current}
		<div id="mega" class="mega only-desktop" role="presentation" onmouseenter={() => enter(current.id)} onmouseleave={leave}>
			<div class="mega-in wrap">
				<a class="mega-hero slant" href={i.href(`/kategorie/${current.slug}`)}>
					{#if current.image}<Picture media={current.image} sizes="40vw" want={1200} alt="" />{/if}
					<span class="mega-hero-text">
						<span class="h3">{current.name}</span>
						<span class="muted small">{i.tr('Alle anzeigen', 'View all')}</span>
					</span>
				</a>
				<div class="mega-list">
					{#if current.tagline}<p class="mega-tag">{current.tagline}</p>{/if}
					{#each current.children as child (child.id)}
						<a class="mega-row" href={i.href(`/kategorie/${child.slug}`)}>
							<span class="thumb slant">{#if child.image}<Picture media={child.image} sizes="160px" want={400} alt="" />{/if}</span>
							<span>
								{#if child.tagline}<span class="row-tag">{child.tagline}</span>{/if}
								<span class="row-name">{child.name}</span>
							</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</header>

{#if drawer}
	<div class="scrim" onclick={() => (drawer = false)} aria-hidden="true"></div>
	<div class="drawer" role="dialog" aria-modal="true" aria-label={i.tr('Menü', 'Menu')}>
		<div class="drawer-head">
			<img src="/bilder/logo.webp" alt="Backyardboys Design" width="600" height="254" />
			<!-- svelte-ignore a11y_autofocus -->
			<button type="button" class="icon-btn" aria-label={i.tr('Menü schließen', 'Close menu')} onclick={() => (drawer = false)} autofocus><X size={24} /></button>
		</div>
		<form class="drawer-search" action={i.href('/produkte')} method="GET" role="search">
			<input class="input" name="q" type="search" placeholder={i.tr('Suchen …', 'Search …')} aria-label={i.tr('Suchbegriff', 'Search term')} />
		</form>
		<ul class="drawer-nav">
			{#each menu as item (item.id)}
				<li>
					{#if item.children.length}
						<button type="button" class="d-link" aria-expanded={expanded === item.id} onclick={() => (expanded = expanded === item.id ? null : item.id)}>
							{item.name}
							<ChevronDown size={18} />
						</button>
						{#if expanded === item.id}
							<ul class="d-sub">
								<li><a href={i.href(`/kategorie/${item.slug}`)}>{i.tr('Alle', 'All')} {item.name}</a></li>
								{#each item.children as child (child.id)}
									<li><a href={i.href(`/kategorie/${child.slug}`)}>{child.name}</a></li>
								{/each}
							</ul>
						{/if}
					{:else}
						<a class="d-link" href={i.href(`/kategorie/${item.slug}`)}>{item.name}</a>
					{/if}
				</li>
			{/each}
			<li><a class="d-link" href={i.href('/bike-finder')}><span><Bike size={18} /> {bike ? bike.label : i.tr('Bike-Finder', 'Bike finder')}</span></a></li>
			<li><a class="d-link" href={i.href('/konto')}>{loggedIn ? i.tr('Mein Konto', 'My account') : i.tr('Anmelden', 'Log in')}</a></li>
			<li><a class="d-link" href={i.href('/kontakt')}>{i.tr('Kontakt', 'Contact')}</a></li>
			<li><a class="d-link" href={switchHref} hreflang={other} lang={other}>{other === 'en' ? 'English' : 'Deutsch'}</a></li>
		</ul>
	</div>
{/if}

<style>
	.head {
		position: sticky;
		top: 0;
		z-index: 40;
		background: #000;
		border-bottom: 1px solid #18181b;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: var(--header-h);
	}
	.logo {
		display: block;
		flex-shrink: 0;
	}
	.logo img {
		height: 2.35rem;
		width: auto;
	}
	@media (max-width: 1023px) {
		.logo {
			position: absolute;
			left: 50%;
			transform: translateX(-50%);
		}
	}
	@media (min-width: 1024px) {
		.logo img {
			height: 2.75rem;
		}
	}
	.nav {
		display: flex;
		align-items: stretch;
		height: 100%;
		margin-left: 1.75rem;
	}
	.nav-item {
		display: flex;
	}
	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0 0.65rem;
		white-space: nowrap;
		color: #fff;
		font-size: 0.875rem;
		font-weight: 700;
		font-stretch: 112%;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
	}
	.nav-link:hover,
	.nav-link[aria-expanded='true'] {
		color: #a1a1aa;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		margin-left: auto;
	}
	.bike {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		max-width: 14rem;
		height: 2.5rem;
		margin-right: 0.35rem;
		padding: 0 0.8rem;
		border: 1px solid #3f3f46;
		color: #fff;
		font-size: 0.8rem;
		font-weight: 650;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bike span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@media (max-width: 1279px) {
		.bike span {
			display: none;
		}
		.bike {
			padding: 0 0.6rem;
			border-color: transparent;
		}
	}
	@media (min-width: 1280px) {
		.nav-link {
			padding: 0 0.9rem;
		}
	}
	.bike:hover {
		border-color: #fff;
	}
	.lang {
		display: inline-grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		color: #a1a1aa;
		font-size: 0.8rem;
		font-weight: 750;
		letter-spacing: 0.05em;
		text-decoration: none;
	}
	.lang:hover {
		color: #fff;
	}
	.cart {
		position: relative;
	}
	.count {
		position: absolute;
		top: 0.2rem;
		right: 0.05rem;
		min-width: 1.15rem;
		height: 1.15rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: var(--holo);
		color: #000;
		font-size: 0.68rem;
		font-weight: 800;
		line-height: 1.15rem;
		text-align: center;
	}
	.only-desktop {
		display: none;
	}
	@media (min-width: 1024px) {
		.only-desktop {
			display: inline-flex;
		}
		.only-mobile {
			display: none;
		}
	}
	.search {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-block: 0.9rem;
		border-top: 1px solid #18181b;
		color: #a1a1aa;
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 2.75rem;
		background: transparent;
		border: 0;
		border-bottom: 1px solid #3f3f46;
		color: #fff;
		font-size: 1.1rem;
	}
	.search input:focus {
		outline: none;
		border-bottom-color: #fff;
	}

	/* Mega-Menü */
	.mega {
		position: absolute;
		left: 0;
		right: 0;
		top: 100%;
		background: #000;
		border-bottom: 1px solid #27272a;
		animation: drop 160ms var(--ease-out);
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	.mega-in {
		display: grid;
		grid-template-columns: 5fr 7fr;
		gap: 2.5rem;
		padding-block: 1.75rem 2.25rem;
	}
	.mega-hero {
		--cut: 5rem;
		position: relative;
		display: block;
		height: 26rem;
		background: #18181b;
		overflow: hidden;
		color: #fff;
		text-decoration: none;
	}
	.mega-hero :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.mega-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.7), transparent 45%);
	}
	.mega-hero-text {
		position: absolute;
		left: 1.4rem;
		bottom: 1.2rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
	}
	.mega-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 0.5rem;
	}
	.mega-tag {
		color: #a1a1aa;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}
	.mega-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		background: #0f0f11;
		color: #fff;
		text-decoration: none;
		transition: background-color 120ms;
	}
	.mega-row:hover {
		background: #18181b;
	}
	.thumb {
		--cut: 1.1rem;
		flex-shrink: 0;
		width: 9rem;
		height: 5.75rem;
		background: #18181b;
		overflow: hidden;
	}
	.thumb :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.row-tag {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: #a1a1aa;
	}
	.row-name {
		display: block;
		font-size: 1.35rem;
		font-weight: 800;
		font-stretch: 118%;
		text-transform: uppercase;
		line-height: 1.1;
	}

	/* Mobiles Menü */
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 0.7);
	}
	.drawer {
		position: fixed;
		z-index: 61;
		top: 0;
		bottom: 0;
		left: 0;
		width: min(22rem, 88vw);
		overflow-y: auto;
		background: #000;
		border-right: 1px solid #27272a;
		padding: 0.75rem 1rem 2rem;
		animation: slide 200ms var(--ease-out);
	}
	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
	}
	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.drawer-head img {
		height: 2.1rem;
		width: auto;
	}
	.drawer-search {
		margin-bottom: 0.75rem;
	}
	.drawer-nav > li {
		border-bottom: 1px solid #18181b;
	}
	.d-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 3.4rem;
		color: #fff;
		font-weight: 750;
		font-stretch: 112%;
		text-transform: uppercase;
		text-decoration: none;
		letter-spacing: 0.03em;
	}
	.d-link span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.d-sub {
		padding: 0 0 0.75rem 0.75rem;
	}
	.d-sub a {
		display: block;
		padding: 0.55rem 0;
		color: #d4d4d8;
		text-decoration: none;
	}
</style>
