/**
 * Rollen und Rechte an einer Stelle. Wer eine Rolle anders zuschneiden will,
 * ändert nur die Tabelle PERMISSIONS.
 */
export const ROLES = ['admin', 'mitarbeiter'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Admin',
	mitarbeiter: 'Mitarbeiter'
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
	admin: 'Alles, inklusive Umsätze, Benutzer, Einstellungen und Sicherungen',
	mitarbeiter: 'Bestellungen, Dekor-Aufträge, Produkte, Kunden und Inhalte – ohne Umsätze und Einstellungen'
};

const PERMISSIONS = {
	/** Bestellungen, Aufträge, Produkte, Kunden, Inhalte */
	'shop.manage': ['admin', 'mitarbeiter'],
	/** Umsätze, Berichte, Rechnungs-Export */
	'finance.view': ['admin'],
	'users.manage': ['admin'],
	'settings.manage': ['admin']
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
	if (!role) return false;
	return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
