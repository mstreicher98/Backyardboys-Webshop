import { redirect } from '@sveltejs/kit';
import { shopBase } from '$lib/server/urls';
import type { RequestHandler } from './$types';

/** Link „Shop ansehen“ bzw. Kundenansicht – der Shop kann auf einer anderen Adresse laufen */
export const GET: RequestHandler = ({ url }) => {
	const pfad = url.searchParams.get('pfad') ?? '/';
	const safe = pfad.startsWith('/') && !pfad.startsWith('//') ? pfad : '/';
	redirect(303, `${shopBase()}${safe}`);
};
