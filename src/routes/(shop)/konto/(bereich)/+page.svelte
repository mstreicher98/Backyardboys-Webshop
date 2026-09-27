<script lang="ts">
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data } = $props();
	const i = getI18n();
	const STATUS: Record<string, [string, string]> = {
		zahlung_offen: ['Zahlung offen', 'Awaiting payment'],
		in_bearbeitung: ['In Bearbeitung', 'Processing'],
		abholbereit: ['Abholbereit', 'Ready for pickup'],
		versendet: ['Versendet', 'Shipped'],
		abgeschlossen: ['Abgeschlossen', 'Completed'],
		storniert: ['Storniert', 'Cancelled']
	};
</script>

<Seo title={i.tr('Mein Konto', 'My account')} noindex />

{#if data.welcome}<p class="alert alert-ok">{i.tr('Willkommen! Dein Konto ist aktiv.', 'Welcome! Your account is active.')}</p>{/if}

{#if data.orders.length}
	<ul class="orders">
		{#each data.orders as o (o.id)}
			<li>
				<a href={i.href(`/konto/bestellungen/${o.number}`)}>
					<span class="n">{i.tr('Bestellung', 'Order')} {o.number}</span>
					<span class="muted small">{i.date(o.createdAt)}</span>
					<span class="tags">
						<span class="badge badge-outline">{i.tr(...STATUS[o.status])}</span>
						{#if o.proofWaiting}<span class="badge">{i.tr('Entwurf zur Freigabe', 'Design to approve')}</span>{/if}
						{#if o.unread > 0}<span class="badge">{i.tr('Neue Nachricht', 'New message')}</span>{/if}
					</span>
					<span class="sum tabular">{i.money(o.total)}</span>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<div class="empty">
		<p class="lead">{i.tr('Noch keine Bestellungen.', 'No orders yet.')}</p>
		<a class="btn" href={i.href('/kategorie/bike-designs')}>{i.tr('Dekore ansehen', 'Browse graphics')}</a>
	</div>
{/if}

<style>
	.alert {
		margin-bottom: 1.5rem;
	}
	.orders li a {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.3rem 1rem;
		padding: 1.1rem 0;
		border-bottom: 1px solid #27272a;
		color: #fff;
		text-decoration: none;
	}
	.orders li a:hover .n {
		text-decoration: underline;
	}
	.n {
		font-weight: 750;
		font-stretch: 108%;
		text-transform: uppercase;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		grid-column: 1;
	}
	.sum {
		grid-row: 1 / span 3;
		grid-column: 2;
		align-self: center;
		font-weight: 750;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}
</style>
