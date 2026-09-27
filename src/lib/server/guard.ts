import { error, redirect } from '@sveltejs/kit';
import { can, type Permission } from '$lib/permissions';
import type { SessionUser } from './auth';

export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) redirect(303, '/admin/login');
	return locals.user;
}

export function requirePermission(locals: App.Locals, permission: Permission): SessionUser {
	const user = requireUser(locals);
	if (!can(user.role, permission)) error(403, 'Dafür fehlt dir die Berechtigung.');
	return user;
}

/** Ganze Zahl aus einem Formularfeld, sonst null */
export function intOrNull(v: FormDataEntryValue | null | undefined): number | null {
	if (v == null) return null;
	const s = String(v).trim();
	if (!s) return null;
	const n = Number(s);
	return Number.isInteger(n) ? n : null;
}

export function str(v: FormDataEntryValue | null | undefined, max = 200): string {
	return String(v ?? '')
		.trim()
		.slice(0, max);
}

export function strOrNull(v: FormDataEntryValue | null | undefined, max = 200): string | null {
	return str(v, max) || null;
}

/** Checkbox: "on" oder "true" = angehakt */
export const checked = (v: FormDataEntryValue | null | undefined) => v === 'on' || v === 'true';

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Nur interne Ziele nach dem Login zulassen */
export function safeNext(v: string | null): string {
	return v && v.startsWith('/admin') && !v.startsWith('//') && !v.startsWith('/admin/login') ? v : '/admin';
}

/** Liste von IDs aus mehrfachen Feldern gleichen Namens */
export function idList(form: FormData, name: string): number[] {
	const out: number[] = [];
	for (const v of form.getAll(name)) {
		const n = intOrNull(v);
		if (n != null && n > 0 && !out.includes(n)) out.push(n);
	}
	return out;
}
