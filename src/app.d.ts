import type { SessionUser } from '$lib/server/auth';
import type { SessionCustomer } from '$lib/server/customer-auth';
import type { Locale } from '$lib/shop-types';

declare global {
	namespace App {
		interface Locals {
			/** Team-Mitglied (interner Bereich) */
			user: SessionUser | null;
			sessionToken: string | null;
			theme: 'light' | 'dark' | 'system';
			/** Angemeldeter Kunde im Shop */
			customer: SessionCustomer | null;
			locale: Locale;
		}
		interface Error {
			message: string;
		}
	}
}

export {};
