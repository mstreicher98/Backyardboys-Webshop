<script lang="ts">
	import { mediaSrc, mediaSrcset, type MediaRef } from '$lib/media';

	interface Props {
		media: MediaRef;
		sizes?: string;
		alt?: string;
		class?: string;
		/** Gewünschte Breite für das src-Fallback */
		want?: number;
		eager?: boolean;
	}

	let { media, sizes = '100vw', alt, class: cls = '', want = 800, eager = false }: Props = $props();
</script>

<img
	src={mediaSrc(media, want)}
	srcset={mediaSrcset(media)}
	{sizes}
	alt={alt ?? media.alt}
	width={media.width}
	height={media.height}
	class={cls}
	loading={eager ? 'eager' : 'lazy'}
	fetchpriority={eager ? 'high' : undefined}
	decoding="async"
/>
