<script lang="ts">
	/** Aktionsleiste unter Formularen: Speichern links, Löschen rechts */
	interface Props {
		busy?: boolean;
		saveLabel?: string;
		/** Rückfrage vor dem Löschen; leer = kein Löschen-Knopf */
		deleteConfirm?: string;
		deleteLabel?: string;
		cancelHref?: string;
	}

	let { busy = false, saveLabel = 'Speichern', deleteConfirm = '', deleteLabel = 'Löschen', cancelHref = '' }: Props = $props();
</script>

<div class="actionbar">
	<button class="btn btn-primary" disabled={busy}>{busy ? 'Speichern …' : saveLabel}</button>
	{#if cancelHref}<a href={cancelHref} class="btn btn-ghost">Abbrechen</a>{/if}
	<span class="spacer"></span>
	{#if deleteConfirm}
		<button
			class="btn btn-danger"
			formaction="?/loeschen"
			formnovalidate
			disabled={busy}
			onclick={(e) => {
				if (!confirm(deleteConfirm)) e.preventDefault();
			}}>{deleteLabel}</button
		>
	{/if}
</div>
