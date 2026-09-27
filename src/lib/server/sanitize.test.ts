import { describe, expect, it } from 'vitest';
import { cleanHtml, excerpt, htmlToText } from './sanitize';

describe('cleanHtml', () => {
	it('entfernt Skripte, Event-Handler und Styles', () => {
		const out = cleanHtml('<p onclick="x()" style="color:red">Hallo<script>alert(1)</script></p><iframe src="https://x"></iframe>');
		expect(out).toBe('<p>Hallo</p>');
	});

	it('lässt nur eigene Bilder zu', () => {
		expect(cleanHtml('<img src="/medien/abc-800.webp" alt="A">')).toBe('<img src="/medien/abc-800.webp" alt="A" />');
		expect(cleanHtml('<img src="https://fremd.example/bild.jpg">')).toBe('');
		expect(cleanHtml('<img src="javascript:alert(1)">')).toBe('');
	});

	it('öffnet externe Links sicher in neuem Tab', () => {
		expect(cleanHtml('<a href="https://www.asfinag.at">A</a>')).toBe('<a href="https://www.asfinag.at" target="_blank" rel="noopener noreferrer">A</a>');
		expect(cleanHtml('<a href="/termine" target="_blank">T</a>')).toBe('<a href="/termine">T</a>');
		expect(cleanHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
	});

	it('liefert für einen leeren Editor einen leeren Text', () => {
		expect(cleanHtml('<p></p>')).toBe('');
	});
});

describe('Vorschautext', () => {
	it('macht aus HTML lesbaren Text', () => {
		expect(htmlToText('<p>Erster&nbsp;Absatz.</p><p>Zweiter &amp; letzter.</p>')).toBe('Erster Absatz. Zweiter & letzter.');
	});

	it('kürzt an einer Wortgrenze', () => {
		const text = `<p>${'Dekor '.repeat(40)}</p>`;
		const out = excerpt(text, 50);
		expect(out.length).toBeLessThanOrEqual(52);
		expect(out.endsWith(' …')).toBe(true);
	});
});
