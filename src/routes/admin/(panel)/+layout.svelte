<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import BarChart3 from '@lucide/svelte/icons/chart-column';
	import Bike from '@lucide/svelte/icons/bike';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileText from '@lucide/svelte/icons/file-text';
	import FolderTree from '@lucide/svelte/icons/folder-tree';
	import Gift from '@lucide/svelte/icons/gift';
	import Home from '@lucide/svelte/icons/house';
	import Images from '@lucide/svelte/icons/images';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Layers from '@lucide/svelte/icons/layers';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Package from '@lucide/svelte/icons/package';
	import Palette from '@lucide/svelte/icons/palette';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Settings from '@lucide/svelte/icons/settings';
	import Sun from '@lucide/svelte/icons/sun';
	import UserCog from '@lucide/svelte/icons/user-cog';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import { can, ROLE_LABELS } from '$lib/permissions';
	import { toasts } from '$lib/toast.svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { dur } from '$lib/motion';

	let { data, children } = $props();

	type Item = { href: string; label: string; icon: typeof Package; exact?: boolean; badge?: number };
	const sections = $derived(
		[
			{
				title: 'Verkauf',
				items: [
					{ href: '/admin', label: 'Übersicht', icon: LayoutDashboard, exact: true },
					{ href: '/admin/bestellungen', label: 'Bestellungen', icon: Receipt, badge: data.badges.orders },
					{ href: '/admin/auftraege', label: 'Dekor-Aufträge', icon: Palette, badge: data.badges.jobs },
					{ href: '/admin/kunden', label: 'Kunden', icon: Users, badge: data.badges.customers },
					{ href: '/admin/anfragen', label: 'Anfragen', icon: Inbox, badge: data.badges.inquiries }
				]
			},
			{
				title: 'Sortiment',
				items: [
					{ href: '/admin/produkte', label: 'Produkte', icon: Package },
					{ href: '/admin/kategorien', label: 'Kategorien', icon: FolderTree },
					{ href: '/admin/upgrades', label: 'Base & Finish', icon: Layers },
					{ href: '/admin/bikes', label: 'Bike-Datenbank', icon: Bike },
					{ href: '/admin/gutscheine', label: 'Gutscheine & Rabatte', icon: Gift }
				]
			},
			{
				title: 'Inhalte',
				items: [
					{ href: '/admin/startseite', label: 'Startseite', icon: Home },
					{ href: '/admin/seiten', label: 'Seiten', icon: FileText },
					{ href: '/admin/bilder', label: 'Mediathek', icon: Images }
				]
			},
			{
				title: 'Verwaltung',
				items: [
					...(can(data.me.role, 'finance.view') ? [{ href: '/admin/berichte', label: 'Berichte', icon: BarChart3 }] : []),
					...(can(data.me.role, 'users.manage') ? [{ href: '/admin/benutzer', label: 'Benutzer', icon: UserCog }] : []),
					...(can(data.me.role, 'settings.manage') ? [{ href: '/admin/einstellungen', label: 'Einstellungen', icon: Settings }] : [])
				]
			}
		].filter((s) => s.items.length) as { title: string; items: Item[] }[]
	);

	const path = $derived(page.url.pathname);
	const active = (item: Item) => (item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`));

	let drawer = $state(false);
	afterNavigate(() => (drawer = false));

	// Meldung aus einer Weiterleitung („gespeichert“) einmal anzeigen
	let lastFlash = 0;
	$effect(() => {
		const f = data.flash;
		if (f && f.id !== lastFlash) {
			lastFlash = f.id;
			toasts.show(f.message, f.kind);
		}
	});

	let theme = $state<'light' | 'dark' | 'system'>('system');
	$effect.pre(() => {
		theme = data.theme;
	});
	function setTheme(t: typeof theme) {
		theme = t;
		document.cookie = `theme=${t === 'system' ? '' : t}; path=/admin; max-age=${t === 'system' ? 0 : 31536000}; samesite=lax`;
		if (t === 'system') document.documentElement.removeAttribute('data-theme');
		else document.documentElement.setAttribute('data-theme', t);
	}
</script>

{#snippet brand(small = false)}
	<a href="/admin" class="brand" class:small-brand={small}>
		<span class="logo"><img src="/bilder/logo.webp" alt="" width="600" height="254" /></span>
		<span>
			{#if !small}<span class="b-small">Backyardboys Design</span>{/if}
			<span class="b-big">Intern</span>
		</span>
	</a>
{/snippet}

{#snippet navList()}
	<nav class="nav" aria-label="Bereiche">
		{#each sections as sct (sct.title)}
			<p class="nav-title">{sct.title}</p>
			<ul>
				{#each sct.items as item (item.href)}
					<li>
						<a href={item.href} aria-current={active(item) ? 'page' : undefined}>
							<item.icon size={18} />
							<span class="nav-label">{item.label}</span>
							{#if item.badge}<span class="nav-badge">{item.badge}</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>
{/snippet}

{#snippet userBox()}
	<div class="user">
		<a href="/admin/konto" class="who" aria-current={path === '/admin/konto' ? 'page' : undefined}>
			<span class="avatar"><UserRound size={18} /></span>
			<span class="who-text">
				<span class="who-name">{data.me.name}</span>
				<span class="who-role">{ROLE_LABELS[data.me.role]}</span>
			</span>
		</a>
		<div class="theme" role="group" aria-label="Darstellung">
			<button type="button" aria-pressed={theme === 'light'} onclick={() => setTheme('light')} title="Hell"><Sun size={16} /></button>
			<button type="button" aria-pressed={theme === 'system'} onclick={() => setTheme('system')} title="Wie das Gerät"><Monitor size={16} /></button>
			<button type="button" aria-pressed={theme === 'dark'} onclick={() => setTheme('dark')} title="Dunkel"><Moon size={16} /></button>
		</div>
		<a href="/admin/zum-shop" class="side-link" target="_blank" rel="noopener"><ExternalLink size={17} /> Shop ansehen</a>
		<form method="POST" action="/admin/logout">
			<button class="side-link"><LogOut size={17} /> Abmelden</button>
		</form>
	</div>
{/snippet}

<div class="shell">
	<aside class="sidebar">
		{@render brand()}
		{@render navList()}
		{@render userBox()}
	</aside>

	<header class="topbar">
		<button type="button" class="menu-btn" aria-label="Menü öffnen" onclick={() => (drawer = true)}><Menu size={24} /></button>
		{@render brand(true)}
	</header>

	{#if drawer}
		<div class="drawer-bg" onclick={() => (drawer = false)} aria-hidden="true" out:fade={{ duration: dur(200) }}></div>
		<div class="drawer" role="dialog" out:fly={{ x: -320, duration: dur(240), easing: cubicIn, opacity: 1 }} aria-modal="true" aria-label="Menü">
			<div class="drawer-head">
				{@render brand()}
				<!-- svelte-ignore a11y_autofocus -->
				<button type="button" class="menu-btn" aria-label="Menü schließen" onclick={() => (drawer = false)} autofocus><X size={24} /></button>
			</div>
			{@render navList()}
			{@render userBox()}
		</div>
	{/if}

	<main class="content">
		<!-- Neu aufbauen, wenn sich die Adresse ändert – Formulare übernehmen sonst Werte der vorigen Seite -->
		{#key path}
			<div class="page-in">{@render children()}</div>
		{/key}
	</main>
</div>

<style>
	.shell {
		min-height: 100dvh;
	}
	@media (min-width: 1024px) {
		.shell {
			display: grid;
			grid-template-columns: var(--sidebar) 1fr;
		}
	}
	.sidebar {
		display: none;
	}
	@media (min-width: 1024px) {
		.sidebar {
			position: sticky;
			top: 0;
			height: 100dvh;
			display: flex;
			flex-direction: column;
			padding: 1.1rem 0.8rem;
			border-right: 1px solid var(--c-line);
			background: var(--c-surface);
			overflow-y: auto;
		}
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0 0.5rem 1rem;
		color: var(--c-ink);
		text-decoration: none;
	}
	.small-brand {
		padding: 0;
	}
	.logo {
		display: grid;
		place-items: center;
		width: 3.3rem;
		height: 2.4rem;
		padding: 0.35rem;
		border-radius: 7px;
		background: #000;
		flex-shrink: 0;
	}
	.small-brand .logo {
		width: 2.8rem;
		height: 2rem;
	}
	.logo img {
		width: 100%;
		height: auto;
	}
	.b-small {
		display: block;
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--c-ink-3);
	}
	.b-big {
		display: block;
		font-size: 1.15rem;
		font-weight: 800;
		font-stretch: 115%;
		text-transform: uppercase;
		line-height: 1;
	}
	.nav ul {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.nav-title {
		margin: 0.9rem 0 0.25rem;
		padding: 0 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--c-ink-3);
	}
	.nav-title:first-child {
		margin-top: 0;
	}
	.nav a {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		height: 2.35rem;
		padding: 0 0.7rem;
		border-radius: 8px;
		color: var(--c-ink-2);
		font-weight: 600;
		font-size: 0.925rem;
		text-decoration: none;
	}
	.nav a {
		transition:
			background-color 140ms,
			color 140ms;
	}
	.nav a:hover {
		background: var(--c-surface-2);
		color: var(--c-ink);
	}
	.nav a[aria-current='page'] {
		background: var(--grad);
		color: #fff;
		box-shadow: 0 8px 20px -12px rgb(121 80 242 / 0.8);
	}
	.nav-label {
		flex: 1;
	}
	.nav-badge {
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--c-surface-3);
		color: var(--c-ink);
		font-size: 0.72rem;
		font-weight: 750;
		line-height: 1.35rem;
		text-align: center;
	}
	.nav a[aria-current='page'] .nav-badge {
		background: rgb(255 255 255 / 0.25);
		color: #fff;
	}
	.user {
		margin-top: auto;
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-top: 1px solid var(--c-line);
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem;
		border-radius: 9px;
		color: var(--c-ink);
		text-decoration: none;
	}
	.who:hover,
	.who[aria-current='page'] {
		background: var(--c-surface-2);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 999px;
		background: var(--c-surface-3);
		color: var(--c-ink-2);
		flex-shrink: 0;
	}
	.who-name {
		display: block;
		font-weight: 650;
		line-height: 1.2;
	}
	.who-role {
		display: block;
		font-size: 0.8rem;
		color: var(--c-ink-3);
	}
	.theme {
		display: flex;
		gap: 0.25rem;
		margin: 0.25rem 0.5rem 0.4rem;
		padding: 0.2rem;
		border-radius: 9px;
		background: var(--c-surface-2);
	}
	.theme button {
		flex: 1;
		display: grid;
		place-items: center;
		height: 1.9rem;
		border-radius: 7px;
		color: var(--c-ink-3);
	}
	.theme button[aria-pressed='true'] {
		background: var(--c-surface);
		color: var(--c-ink);
		box-shadow: var(--shadow-1);
	}
	.side-link {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		height: 2.3rem;
		padding: 0 0.75rem;
		border-radius: 9px;
		color: var(--c-ink-2);
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
	}
	.side-link:hover {
		background: var(--c-surface-2);
		color: var(--c-ink);
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 3.5rem;
		padding: 0 0.5rem;
		background: var(--c-surface);
		border-bottom: 1px solid var(--c-line);
	}
	@media (min-width: 1024px) {
		.topbar {
			display: none;
		}
	}
	.menu-btn {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 9px;
		color: var(--c-ink);
	}
	.menu-btn:hover {
		background: var(--c-surface-2);
	}
	.drawer-bg {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: var(--c-scrim);
		animation: fade-in 200ms var(--ease-out);
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	.drawer {
		position: fixed;
		z-index: 51;
		top: 0;
		bottom: 0;
		left: 0;
		width: min(19rem, 86vw);
		display: flex;
		flex-direction: column;
		padding: 0.75rem 0.9rem 1rem;
		background: var(--c-surface);
		overflow-y: auto;
		box-shadow: var(--shadow-modal);
		animation: slide 380ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes slide {
		from {
			transform: translateX(-100%);
		}
	}
	.drawer-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}
	.content {
		min-width: 0;
		padding: 1.25rem 1rem 2rem;
	}
	@media (min-width: 640px) {
		.content {
			padding: 2rem 2rem 3rem;
		}
	}
	@media (min-width: 1280px) {
		.content {
			padding: 2.25rem 3rem 3rem;
		}
	}
</style>
