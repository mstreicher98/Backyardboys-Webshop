<script lang="ts">
	import { onMount } from 'svelte';
	import { toasts } from '$lib/toast.svelte';

	/**
	 * Push-Nachrichten auf diesem Gerät ein-/ausschalten. iPhone: nur, wenn der
	 * Admin-Bereich über „Zum Home-Bildschirm“ als App installiert ist.
	 */
	let mode = $state<'laden' | 'nicht_moeglich' | 'ios_installieren' | 'blockiert' | 'aus' | 'an'>('laden');
	let busy = $state(false);

	const b64ToBytes = (b64: string) => {
		const pad = '='.repeat((4 - (b64.length % 4)) % 4);
		const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(raw, (c) => c.charCodeAt(0));
	};

	async function registration() {
		return navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' });
	}

	onMount(async () => {
		const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
		const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			mode = ios && !standalone ? 'ios_installieren' : 'nicht_moeglich';
			return;
		}
		if (Notification.permission === 'denied') {
			mode = 'blockiert';
			return;
		}
		const reg = await registration();
		const sub = await reg.pushManager.getSubscription();
		mode = sub ? 'an' : 'aus';
	});

	async function enable() {
		busy = true;
		try {
			const perm = await Notification.requestPermission();
			if (perm !== 'granted') {
				mode = perm === 'denied' ? 'blockiert' : 'aus';
				return;
			}
			const { key } = await (await fetch('/admin/api/push')).json();
			const reg = await registration();
			await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
			const res = await fetch('/admin/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
			if (!res.ok) throw new Error();
			mode = 'an';
			toasts.show('Benachrichtigungen auf diesem Gerät eingeschaltet.');
		} catch {
			toasts.show('Einschalten hat nicht geklappt.', 'error');
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		try {
			const reg = await registration();
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await fetch('/admin/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
				await sub.unsubscribe();
			}
			mode = 'aus';
		} finally {
			busy = false;
		}
	}

	async function test() {
		await fetch('/admin/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) });
		toasts.show('Test gesendet – kommt gleich an.');
	}
</script>

{#if mode === 'laden'}
	<p class="muted small">Wird geprüft …</p>
{:else if mode === 'an'}
	<p class="small">Auf diesem Gerät <strong>eingeschaltet</strong>.</p>
	<div class="row">
		<button type="button" class="btn btn-sm" onclick={test}>Test senden</button>
		<button type="button" class="btn btn-sm btn-ghost" onclick={disable} disabled={busy}>Ausschalten</button>
	</div>
{:else if mode === 'aus'}
	<button type="button" class="btn btn-primary btn-sm" onclick={enable} disabled={busy}>Auf diesem Gerät einschalten</button>
{:else if mode === 'blockiert'}
	<p class="alert alert-warn">Benachrichtigungen sind im Browser blockiert. In den Website-Einstellungen des Browsers für diese Seite erlauben und neu laden.</p>
{:else if mode === 'ios_installieren'}
	<p class="alert alert-info">iPhone: Im Safari-Menü „Teilen“ → „Zum Home-Bildschirm“ wählen, den Admin-Bereich über das neue Symbol öffnen und hier einschalten.</p>
{:else}
	<p class="muted small">Dieser Browser unterstützt keine Push-Nachrichten.</p>
{/if}

<style>
	.row {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}
</style>
