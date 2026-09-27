import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, currentStep, hotp, verifyTotp } from './totp';

describe('TOTP', () => {
	// Testwerte aus RFC 6238, Anhang B (SHA-1, Schlüssel "12345678901234567890", 8 Stellen)
	const key = Buffer.from('12345678901234567890');
	it.each([
		[59, '94287082'],
		[1111111109, '07081804'],
		[1234567890, '89005924'],
		[2000000000, '69279037']
	])('liefert bei t=%i den Code %s', (t, code) => {
		expect(hotp(key, Math.floor(t / 30), 8)).toBe(code);
	});

	it('kodiert Base32 hin und zurück', () => {
		const secret = base32Encode(key);
		expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
		expect(base32Decode(secret).equals(key)).toBe(true);
	});

	it('akzeptiert den aktuellen und benachbarte Codes, aber keinen verbrauchten', () => {
		const secret = base32Encode(key);
		const now = 1_790_000_000_000;
		const step = currentStep(now);
		const code = hotp(key, step);
		expect(verifyTotp(secret, code, null, now)).toBe(step);
		expect(verifyTotp(secret, hotp(key, step - 1), null, now)).toBe(step - 1);
		expect(verifyTotp(secret, hotp(key, step - 3), null, now)).toBeNull();
		// schon benutzt → darf nicht nochmal gelten
		expect(verifyTotp(secret, code, step, now)).toBeNull();
		expect(verifyTotp(secret, 'abcdef', null, now)).toBeNull();
		expect(verifyTotp(secret, code.slice(0, 3) + ' ' + code.slice(3), null, now)).toBe(step);
	});
});
