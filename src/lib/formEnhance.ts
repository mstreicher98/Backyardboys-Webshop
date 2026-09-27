import type { SubmitFunction } from '@sveltejs/kit';
import { toasts } from '$lib/toast.svelte';

/**
 * Gemeinsames Verhalten für Admin-Formulare: Knöpfe sperren, Fehler als Toast,
 * Eingaben bei Fehlern stehen lassen, Erfolgsmeldung aus `{ message }` anzeigen.
 */
export function submitting(setBusy: (b: boolean) => void, opts: { onSuccess?: () => void; onError?: (msg: string) => void } = {}): SubmitFunction {
	return () => {
		setBusy(true);
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				const msg = String(result.data?.error ?? 'Speichern fehlgeschlagen.');
				toasts.show(msg, 'error');
				opts.onError?.(msg);
			} else if (result.type === 'success') {
				if (result.data?.message) toasts.show(String(result.data.message));
				opts.onSuccess?.();
			} else if (result.type === 'error') {
				toasts.show(result.error?.message ?? 'Unerwarteter Fehler.', 'error');
			}
			await update({ reset: false });
			setBusy(false);
		};
	};
}
