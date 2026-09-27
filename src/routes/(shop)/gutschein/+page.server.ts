import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { giftCards } from '$lib/server/db/schema';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const L = (de: string, en: string) => (locals.locale === 'en' ? en : de);
		const key = `gutschein:${getClientAddress()}`;
		if (isRateLimited(key, 10)) return fail(429, { error: L('Zu viele Versuche. Bitte in 15 Minuten erneut.', 'Too many attempts. Please try again in 15 minutes.') });
		const code = String((await request.formData()).get('code') ?? '')
			.trim()
			.toUpperCase()
			.slice(0, 40);
		const card = code
			? await db
					.select()
					.from(giftCards)
					.where(sql`upper(${giftCards.code}) = ${code}`)
					.get()
			: null;
		if (!card) {
			registerFailure(key);
			return fail(400, { code, error: L('Diesen Gutscheincode kennen wir nicht.', "We don't know this gift card code.") });
		}
		return { code: card.code, balance: card.active ? card.balance : 0, initial: card.initialValue, active: card.active };
	}
};
