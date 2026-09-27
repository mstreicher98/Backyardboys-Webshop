import type { FieldType, PersonalizationField } from '$lib/shop-types';

/** Leeres Personalisierungs-Feld für den Produkt-Editor */
export function emptyField(type: FieldType = 'text', key = ''): PersonalizationField {
	return {
		key: key || `feld_${Math.random().toString(36).slice(2, 7)}`,
		type,
		label: '',
		labelEn: '',
		help: '',
		helpEn: '',
		placeholder: '',
		placeholderEn: '',
		required: false,
		choices: [],
		maxLength: type === 'textarea' ? 2000 : 120,
		surcharge: 0,
		maxFiles: type === 'datei' ? 3 : 1
	};
}

const f = (type: FieldType, key: string, over: Partial<PersonalizationField>): PersonalizationField => ({ ...emptyField(type, key), ...over });

/**
 * Vorlagen für die drei Dekor-Arten – übernommen aus dem Formular des Prototyps.
 * Im Editor lassen sich die Felder danach beliebig anpassen.
 */
export const FIELD_PRESETS: Record<'full_custom' | 'semi_custom' | 'reprint', PersonalizationField[]> = {
	full_custom: [
		f('bike', 'bike', { label: 'Dein Bike', labelEn: 'Your bike', required: true }),
		f('textarea', 'kunststoffteile', {
			label: 'Informationen über deine Kunststoffteile',
			labelEn: 'About your plastics',
			placeholder: 'z. B. schwarze Kunststoffteile mit KTM SMCR Kotflügel',
			placeholderEn: 'e.g. black plastics with KTM SMCR fender',
			maxLength: 500
		}),
		f('textarea', 'farben', {
			label: 'Farben',
			labelEn: 'Colours',
			placeholder: 'z. B. Rot mit weißen Details, schwarzer Hintergrund',
			placeholderEn: 'e.g. red with white details, black background',
			maxLength: 500
		}),
		f('textarea', 'design', {
			label: 'Wie möchtest du dein Design gestalten?',
			labelEn: 'How would you like your design?',
			placeholder: 'Ich möchte den Text „XXXX“ auf dem Bürzel und das „XXXX“-Logo auf der Airbox. Das Design soll aggressiv wirken, mit schwarzer Basis und lila Chrome-Details.',
			placeholderEn: 'I want the text "XXXX" on the tail and the "XXXX" logo on the airbox. The design should look aggressive, black base with purple chrome details.',
			required: true,
			maxLength: 4000
		}),
		f('text', 'startnummer', { label: 'Startnummer', labelEn: 'Race number', maxLength: 4 }),
		f('datei', 'vorlagen', {
			label: 'Fotos, Logos oder Vorlagen',
			labelEn: 'Photos, logos or references',
			help: 'Fotos von deinem Bike, Logos (am besten als Vektordatei) oder Designs, die dir gefallen.',
			helpEn: 'Photos of your bike, logos (ideally as vector files) or designs you like.',
			maxFiles: 8
		})
	],
	semi_custom: [
		f('bike', 'bike', { label: 'Dein Bike', labelEn: 'Your bike', required: true }),
		f('textarea', 'kunststoffteile', {
			label: 'Informationen über deine Kunststoffteile',
			labelEn: 'About your plastics',
			placeholder: 'z. B. originale Kunststoffteile in Weiß',
			placeholderEn: 'e.g. original plastics in white',
			maxLength: 500
		}),
		f('text', 'name', { label: 'Name / Schriftzug', labelEn: 'Name / lettering', maxLength: 30 }),
		f('text', 'startnummer', { label: 'Startnummer', labelEn: 'Race number', maxLength: 4 }),
		f('datei', 'logo', { label: 'Eigenes Logo', labelEn: 'Your own logo', help: 'Optional, am besten als SVG, AI, EPS oder PDF.', helpEn: 'Optional, ideally SVG, AI, EPS or PDF.', maxFiles: 2 })
	],
	reprint: [
		f('text', 'bestellnummer', {
			label: 'Nummer deiner früheren Bestellung',
			labelEn: 'Number of your earlier order',
			required: true,
			maxLength: 20,
			help: 'Steht in der Bestellbestätigung. Kein Konto? Dann die E-Mail-Adresse, mit der du bestellt hast.',
			helpEn: 'Shown in the order confirmation. No number? Enter the email you ordered with.'
		}),
		f('textarea', 'umfang', {
			label: 'Was sollen wir neu drucken?',
			labelEn: 'What should we reprint?',
			placeholder: 'z. B. komplettes Kit, oder nur Seitenteile links und rechts',
			placeholderEn: 'e.g. the complete kit, or just the left and right side panels',
			required: true,
			maxLength: 2000
		}),
		f('textarea', 'aenderungen', { label: 'Änderungen gegenüber damals (optional)', labelEn: 'Changes compared to last time (optional)', maxLength: 2000 })
	]
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
	text: 'Textzeile',
	textarea: 'Textfeld (mehrzeilig)',
	number: 'Zahl',
	select: 'Auswahl',
	datei: 'Datei-Upload',
	bike: 'Bike (Marke, Modell, Baujahr)'
};
