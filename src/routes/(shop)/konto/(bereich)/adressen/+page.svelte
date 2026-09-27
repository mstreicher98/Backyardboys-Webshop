<script lang="ts">
	import { enhance } from '$app/forms';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';

	let { data, form } = $props();
	const i = getI18n();
	type A = (typeof data.addresses)[number];
	let editing = $state<Partial<A> | null>(null);
	const countryName = (code: string) => data.countries.find((c) => c.code === code)?.name ?? code;
</script>

<Seo title={i.tr('Adressen', 'Addresses')} noindex />

{#if form?.ok}<p class="alert alert-ok">{form.ok}</p>{/if}

<div class="grid">
	{#each data.addresses as a (a.id)}
		<div class="panel card">
			{#if a.isDefault}<span class="badge">{i.tr('Standard', 'Default')}</span>{/if}
			<address>
				{#if a.company}{a.company}<br />{/if}{a.firstName} {a.lastName}<br />{a.street}<br />{a.zip} {a.city}<br />{countryName(a.country)}
				{#if a.phone}<br />{a.phone}{/if}
			</address>
			<div class="actions">
				<button type="button" class="link small" onclick={() => (editing = { ...a })}>{i.tr('Bearbeiten', 'Edit')}</button>
				{#if !a.isDefault}
					<form method="POST" action="?/standard" use:enhance><input type="hidden" name="id" value={a.id} /><button class="link small">{i.tr('Als Standard', 'Make default')}</button></form>
				{/if}
				<form method="POST" action="?/loeschen" use:enhance><input type="hidden" name="id" value={a.id} /><button class="link small">{i.tr('Löschen', 'Delete')}</button></form>
			</div>
		</div>
	{/each}
	<button type="button" class="panel add" onclick={() => (editing = { country: 'AT' })}>+ {i.tr('Neue Adresse', 'New address')}</button>
</div>

{#if editing}
	<form
		method="POST"
		action="?/speichern"
		class="panel edit"
		use:enhance={() =>
			async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success') editing = null;
			}}
	>
		<h2 class="h3">{editing.id ? i.tr('Adresse bearbeiten', 'Edit address') : i.tr('Neue Adresse', 'New address')}</h2>
		{#if form?.error}<p class="alert alert-error">{form.error}</p>{/if}
		<input type="hidden" name="id" value={editing.id ?? ''} />
		<div class="grid-2">
			<label class="field"><span class="label">{i.tr('Vorname', 'First name')} *</span><input class="input" name="vorname" required value={editing.firstName ?? ''} /></label>
			<label class="field"><span class="label">{i.tr('Nachname', 'Last name')} *</span><input class="input" name="nachname" required value={editing.lastName ?? ''} /></label>
		</div>
		<label class="field"><span class="label">{i.tr('Firma', 'Company')}</span><input class="input" name="firma" value={editing.company ?? ''} /></label>
		<label class="field"><span class="label">{i.tr('Straße und Hausnummer', 'Street and number')} *</span><input class="input" name="strasse" required value={editing.street ?? ''} /></label>
		<div class="grid-2">
			<label class="field"><span class="label">{i.tr('PLZ', 'Postcode')} *</span><input class="input" name="plz" required value={editing.zip ?? ''} /></label>
			<label class="field"><span class="label">{i.tr('Ort', 'City')} *</span><input class="input" name="ort" required value={editing.city ?? ''} /></label>
		</div>
		<div class="grid-2">
			<label class="field">
				<span class="label">{i.tr('Land', 'Country')} *</span>
				<select class="select" name="land" value={editing.country ?? 'AT'}>
					{#each data.countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
				</select>
			</label>
			<label class="field"><span class="label">{i.tr('Telefon', 'Phone')}</span><input class="input" name="telefon" type="tel" value={editing.phone ?? ''} /></label>
		</div>
		<div class="row">
			<button class="btn">{i.tr('Speichern', 'Save')}</button>
			<button type="button" class="btn btn-ghost" onclick={() => (editing = null)}>{i.tr('Abbrechen', 'Cancel')}</button>
		</div>
	</form>
{/if}

<style>
	.alert {
		margin-bottom: 1.25rem;
	}
	.grid {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 768px) {
		.grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}
	address {
		font-style: normal;
		color: #d4d4d8;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: auto;
	}
	.add {
		min-height: 9rem;
		color: #a1a1aa;
		font-weight: 700;
		box-shadow: inset 0 0 0 1.5px dashed #3f3f46;
		border: 1.5px dashed #3f3f46;
		background: transparent;
	}
	.add:hover {
		color: #fff;
		border-color: #fff;
	}
	.edit {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 2rem;
		max-width: 44rem;
	}
	.row {
		display: flex;
		gap: 0.75rem;
	}
</style>
