/** Reiner Text aus einfachem HTML (Meta-Beschreibungen, strukturierte Daten) – auch im Browser nutzbar */
export function htmlText(html: string): string {
	return html
		.replace(/<\/(p|h\d|li|blockquote)>/g, ' ')
		.replace(/<br\s*\/?>/g, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}
