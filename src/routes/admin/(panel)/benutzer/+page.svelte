<script lang="ts">
	import { enhance } from '$app/forms';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldOff from '@lucide/svelte/icons/shield-off';
	import { relativeTime } from '$lib/format';
	import { submitting } from '$lib/formEnhance';
	import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '$lib/permissions';
	import { toasts } from '$lib/toast.svelte';

	let { data, form } = $props();

	let adding = $state(false);
	let busy = $state(false);
	const setBusy = (b: boolean) => (busy = b);

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toasts.show('Kopiert');
		} catch {
			/* Text ist markierbar */
		}
	}

	const ask = (msg: string) => (e: MouseEvent) => {
		if (!confirm(msg)) e.preventDefault();
	};
</script>

<svelte:head><title>Benutzer | BYB Intern</title></svelte:head>

<div class="page-head">
	<div>
		<h1 class="page-title">Benutzer</h1>
		<p class="page-sub">Wer den internen Bereich nutzen darf. Neue Zugänge richten beim ersten Login ein eigenes Passwort und die Authenticator-App ein.</p>
	</div>
	<button type="button" class="btn btn-primary" onclick={() => (adding = !adding)}><Plus size={18} /> Zugang anlegen</button>
</div>

{#if form?.password}
	<div class="card card-pad secret">
		<KeyRound size={22} />
		<div>
			<p><strong>Vorläufiges Passwort für {form.forName}</strong> (Benutzername <strong>{form.forUser}</strong>):</p>
			<p class="pw"><code>{form.password}</code> <button type="button" class="btn btn-sm" onclick={() => copy(form.password)}><Copy size={15} /> Kopieren</button></p>
			<p class="hint">Wird nur jetzt angezeigt. Bitte persönlich oder per Telefon weitergeben, nicht per E-Mail oder Chat zusammen mit dem Benutzernamen.</p>
		</div>
	</div>
{/if}

{#if adding}
	<form method="POST" action="?/anlegen" class="card card-pad stack add" use:enhance={submitting(setBusy, { onSuccess: () => (adding = false) })}>
		<h2 class="card-title">Neuer Zugang</h2>
		<div class="grid-3">
			<label class="field"><span class="label">Name</span><input class="input" name="name" required maxlength="80" placeholder="Vor- und Nachname" /></label>
			<label class="field"><span class="label">Benutzername</span><input class="input" name="benutzername" required maxlength="40" pattern={'[a-z0-9._\\-]{3,40}'} autocapitalize="none" placeholder="z. B. mhuber" /></label>
			<label class="field"><span class="label">E-Mail <span class="opt">(optional)</span></span><input class="input" type="email" name="email" maxlength="120" /></label>
		</div>
		<fieldset class="field">
			<legend class="label">Rolle</legend>
			<div class="roles">
				{#each ROLES as r (r)}
					<label class="check">
						<input type="radio" name="rolle" value={r} checked={r === 'mitarbeiter'} />
						<span><span class="check-title">{ROLE_LABELS[r]}</span><br /><span class="hint">{ROLE_DESCRIPTIONS[r]}</span></span>
					</label>
				{/each}
			</div>
		</fieldset>
		<div class="row-btns">
			<button class="btn btn-primary" disabled={busy}>Anlegen und Passwort erzeugen</button>
			<button type="button" class="btn btn-ghost" onclick={() => (adding = false)}>Abbrechen</button>
		</div>
	</form>
{/if}

<div class="list">
	{#each data.users as u (u.id)}
		<article class="card card-pad user" class:off={!u.active}>
			<div class="top">
				<div>
					<h2 class="name">{u.name} {#if u.id === data.me.id}<span class="badge">Du</span>{/if}</h2>
					<p class="muted small">{u.username}{u.email ? `, ${u.email}` : ''}</p>
				</div>
				<div class="badges">
					<span class="badge {u.role === 'admin' ? 'badge-red' : 'badge-info'}">{ROLE_LABELS[u.role]}</span>
					{#if !u.active}<span class="badge">Gesperrt</span>{/if}
					{#if u.totpEnabled}
						<span class="badge badge-ok"><ShieldCheck size={13} /> 2FA aktiv</span>
					{:else}
						<span class="badge badge-warn"><ShieldOff size={13} /> 2FA offen</span>
					{/if}
				</div>
			</div>
			<p class="muted small">
				{u.lastLoginAt ? `Zuletzt angemeldet ${relativeTime(u.lastLoginAt)}` : 'Noch nie angemeldet'}{u.mustChangePassword ? ', muss noch ein eigenes Passwort festlegen' : ''}
			</p>
			<div class="actions">
				{#if !u.owner && u.id !== data.me.id}
					<form method="POST" action="?/rolle" use:enhance={submitting(setBusy)} class="inline">
						<input type="hidden" name="id" value={u.id} />
						<select class="select sel" name="rolle" value={u.role} onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Rolle von {u.name}">
							{#each ROLES as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
						</select>
					</form>
				{/if}
				<form method="POST" action="?/passwort" use:enhance={submitting(setBusy)}>
					<input type="hidden" name="id" value={u.id} />
					<button class="btn btn-sm" disabled={busy} onclick={ask(`Neues vorläufiges Passwort für ${u.name} erzeugen? Das alte gilt dann nicht mehr.`)}>Passwort zurücksetzen</button>
				</form>
				{#if u.totpEnabled}
					<form method="POST" action="?/zweiFaktor" use:enhance={submitting(setBusy)}>
						<input type="hidden" name="id" value={u.id} />
						<button class="btn btn-sm" disabled={busy} onclick={ask(`Authenticator-App von ${u.name} zurücksetzen? Die App muss beim nächsten Login neu gekoppelt werden.`)}>2FA zurücksetzen</button>
					</form>
				{/if}
				{#if !u.owner && u.id !== data.me.id}
					<form method="POST" action="?/aktiv" use:enhance={submitting(setBusy)}>
						<input type="hidden" name="id" value={u.id} />
						<button class="btn btn-sm" disabled={busy}>{u.active ? 'Sperren' : 'Entsperren'}</button>
					</form>
					<form method="POST" action="?/loeschen" use:enhance={submitting(setBusy)}>
						<input type="hidden" name="id" value={u.id} />
						<button class="btn btn-sm btn-danger" disabled={busy} onclick={ask(`Zugang von ${u.name} endgültig löschen?`)}>Löschen</button>
					</form>
				{/if}
			</div>
		</article>
	{/each}
</div>

<style>
	.secret {
		display: flex;
		gap: 0.9rem;
		margin-bottom: 1rem;
		border-color: var(--c-ok);
		background: var(--c-ok-soft);
	}
	.secret :global(svg) {
		flex-shrink: 0;
		color: var(--c-ok);
	}
	.pw {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.5rem 0;
	}
	.pw code {
		padding: 0.35rem 0.6rem;
		border-radius: 7px;
		background: var(--c-surface);
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		user-select: all;
	}
	.add {
		margin-bottom: 1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.roles {
		display: grid;
		gap: 0.6rem;
	}
	@media (min-width: 640px) {
		.roles {
			grid-template-columns: 1fr 1fr;
		}
	}
	.row-btns {
		display: flex;
		gap: 0.5rem;
	}
	.list {
		display: grid;
		gap: 0.75rem;
	}
	.user.off {
		opacity: 0.65;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.1rem;
		font-weight: 700;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}
	.sel {
		min-height: 2.1rem;
		height: 2.1rem;
		padding-top: 0;
		padding-bottom: 0;
		font-size: 0.85rem !important;
		width: auto;
	}
</style>
