import { describe, expect, it } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it('wandelt Umlaute und Sonderzeichen um', () => {
		expect(slugify('Semi Custom – Japan Edition')).toBe('semi-custom-japan-edition');
		expect(slugify('Hoodie „Größe“ Schwarz')).toBe('hoodie-groesse-schwarz');
	});
});
