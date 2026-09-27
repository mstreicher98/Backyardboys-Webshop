import { prefersReducedMotion } from 'svelte/motion';

/** Dauer für Svelte-Übergänge – bei „weniger Bewegung“ sofort */
export const dur = (ms: number) => (prefersReducedMotion.current ? 0 : ms);

interface RevealOptions {
	/** Alle direkten Kinder einzeln einblenden (Raster), gestaffelt je Schub */
	group?: boolean;
	/** Abstand zwischen den Elementen eines Schubs */
	stagger?: number;
	/** „cut“ = schräger Wisch statt Hochgleiten */
	variant?: 'cut';
}

/**
 * Blendet Inhalte beim Hineinscrollen ein (Klassen in shop.css).
 * Was beim Laden schon im Bild ist, bleibt unangetastet – kein Flackern, kein Warten
 * aufs Skript; ohne JavaScript und bei „weniger Bewegung“ ist alles sofort sichtbar.
 */
export function reveal(node: HTMLElement, opts: RevealOptions = {}) {
	if (prefersReducedMotion.current || typeof IntersectionObserver === 'undefined') return;
	const targets = (opts.group ? [...node.children] : [node]) as HTMLElement[];
	const fold = window.innerHeight * 0.95;
	const later = targets.filter((t) => t.getBoundingClientRect().top > fold);
	if (!later.length) return;

	const io = new IntersectionObserver(
		(entries) => {
			let n = 0;
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				const el = e.target as HTMLElement;
				const delay = n++ * (opts.stagger ?? 80);
				el.style.setProperty('--rv-delay', `${delay}ms`);
				el.classList.add('rv-in');
				io.unobserve(el);
				// Danach aufräumen, damit Hover-Effekte wieder ohne Verzögerung reagieren
				setTimeout(() => {
					el.classList.remove('rv', 'rv-in');
					delete el.dataset.rv;
					el.style.removeProperty('--rv-delay');
				}, delay + 1800);
			}
		},
		{ rootMargin: '0px 0px -6% 0px' }
	);
	for (const t of later) {
		t.classList.add('rv');
		if (opts.variant) t.dataset.rv = opts.variant;
		io.observe(t);
	}
	return {
		destroy() {
			io.disconnect();
		}
	};
}
