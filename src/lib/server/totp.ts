import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Zeitbasierte Einmal-Codes nach RFC 6238 (SHA-1, 6 Stellen, 30 Sekunden) –
 * kompatibel mit Google/Microsoft Authenticator, Aegis, 1Password usw.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of buf) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(input: string): Buffer {
	const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const ch of clean) {
		value = (value << 5) | ALPHABET.indexOf(ch);
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export function generateSecret(): string {
	return base32Encode(randomBytes(20));
}

export function hotp(key: Buffer, counter: number, digits = DIGITS, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(counter));
	const h = createHmac(algo, key).update(msg).digest();
	const off = h[h.length - 1] & 0x0f;
	const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
	return String(bin % 10 ** digits).padStart(digits, '0');
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Prüft einen Code mit ±1 Schritt Toleranz (Uhrabweichung am Handy).
 * Gibt den getroffenen Schritt zurück – oder null. Schritte ≤ lastStep sind
 * verbraucht, damit ein abgefangener Code nicht ein zweites Mal gilt.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
	const token = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(token)) return null;
	const key = base32Decode(secret);
	const step = currentStep(now);
	for (const s of [step, step - 1, step + 1]) {
		if (lastStep != null && s <= lastStep) continue;
		const expected = Buffer.from(hotp(key, s));
		if (timingSafeEqual(expected, Buffer.from(token))) return s;
	}
	return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
	const label = encodeURIComponent(`${issuer}:${account}`);
	const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
	return `otpauth://totp/${label}?${params}`;
}

/** Geheimnis in Vierergruppen – zum Abtippen, falls der QR-Code nicht geht */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();
