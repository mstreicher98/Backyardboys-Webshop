import sanitizeHtml from 'sanitize-html';

/**
 * Was der Editor liefern darf. Alles andere – Skripte, Styles, fremde Bilder –
 * wird beim Speichern entfernt. Bilder nur aus der eigenen Mediathek.
 */
const OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'img'],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		img: ['src', 'alt', 'width', 'height'],
		ol: ['start']
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesByTag: { img: [] },
	allowProtocolRelative: false,
	exclusiveFilter: (frame) => frame.tag === 'img' && !/^\/(medien|bilder)\//.test(frame.attribs.src ?? ''),
	transformTags: {
		b: 'strong',
		i: 'em',
		a: (tagName, attribs) => {
			const href = attribs.href ?? '';
			const out: Record<string, string> = { href };
			// Externe Links in neuem Tab, ohne Rückgriff auf unsere Seite
			if (/^https?:\/\//i.test(href)) {
				out.target = '_blank';
				out.rel = 'noopener noreferrer';
			}
			return { tagName, attribs: out };
		}
	}
};

export function cleanHtml(html: string): string {
	const out = sanitizeHtml(html, OPTIONS).trim();
	// Leerer Editor liefert "<p></p>"
	return out === '<p></p>' ? '' : out;
}

/** Reiner Text aus HTML, z. B. für Vorschautexte und Meta-Beschreibungen */
export function htmlToText(html: string): string {
	return sanitizeHtml(html.replace(/<\/(p|h\d|li|blockquote)>/g, ' </$1>').replace(/<br\s*\/?>/g, ' '), {
		allowedTags: [],
		allowedAttributes: {}
	})
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function excerpt(html: string, max = 180): string {
	const text = htmlToText(html);
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const space = cut.lastIndexOf(' ');
	return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[,.;:–-]+$/, '')} …`;
}
