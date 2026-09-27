<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import BikePicker from '$lib/components/shop/BikePicker.svelte';
	import Picture from '$lib/components/shop/Picture.svelte';
	import ProductCard from '$lib/components/shop/ProductCard.svelte';
	import Seo from '$lib/components/shop/Seo.svelte';
	import { getI18n } from '$lib/i18n.svelte';
	import { reveal } from '$lib/motion';

	let { data } = $props();
	const i = getI18n();

	// „Dein Bike. Dein Style. Dein Statement.“ → eine Zeile je Satz
	const heroLines = $derived(
		data.hero.title
			.split(/(?<=\.)\s+/)
			.map((s) => s.trim())
			.filter(Boolean)
	);
</script>

<Seo title="Backyardboys Design" description={data.hero.text} image={data.hero.image ? `/medien/${data.hero.image.file}-1600.webp` : null} />

<section class="hero">
	<div class="hero-img slant">
		<div class="hero-media">
			{#if data.hero.image}
				<Picture media={data.hero.image} sizes="(min-width: 1024px) 60vw, 100vw" want={1600} eager alt="" />
			{:else}
				<img src="/bilder/hero.webp" alt="" width="1600" height="1600" fetchpriority="high" />
			{/if}
		</div>
		<!-- Verlaufs-Streifen legt das Bild frei – wie beim Aufziehen eines Dekors -->
		<span class="sweep" aria-hidden="true"></span>
	</div>
	<div class="hero-text wrap">
		<h1 class="display">
			{#each heroLines as line, n (n)}<span class="line" style="--i: {n}"><span>{line}</span></span>{/each}
		</h1>
		<span class="grad-bar" aria-hidden="true"></span>
		<p class="lead">{data.hero.text}</p>
		<div class="ctas">
			<a class="btn" href={i.href('/kategorie/bike-designs')}>{i.tr('Dekore entdecken', 'Explore graphics')}</a>
			<a class="btn btn-ghost" href={i.href('/kategorie/full-custom')}>{i.tr('Full Custom anfragen', 'Start a full custom')}</a>
		</div>
	</div>
</section>

{#if data.bikes.brands.length}
	<section class="finder">
		<form class="wrap finder-in" method="POST" action={i.href('/bike-finder')}>
			<div>
				<h2 class="h3">{i.tr('Was fährst du?', 'What do you ride?')}</h2>
				<p class="muted small">{i.tr('Wir zeigen dir die Dekore, die auf dein Bike passen.', "We'll show you the graphics that fit your bike.")}</p>
			</div>
			<BikePicker catalog={data.bikes} required />
			<button class="btn">{i.tr('Passende Dekore', 'Matching graphics')}</button>
		</form>
	</section>
{/if}

{#if data.categories.length}
	<section class="wrap section cats" use:reveal={{ group: true, variant: 'cut', stagger: 130 }}>
		{#each data.categories as c (c.id)}
			<a class="cat" href={i.href(`/kategorie/${c.slug}`)}>
				<span class="cat-img slant">{#if c.image}<Picture media={c.image} sizes="(min-width: 1024px) 33vw, 100vw" want={1200} alt="" />{/if}</span>
				<span class="cat-text">
					{#if c.tagline}<span class="muted small">{c.tagline}</span>{/if}
					<span class="display cat-name">{c.name}</span>
				</span>
			</a>
		{/each}
	</section>
{/if}

{#if data.featured.length}
	<section class="wrap section">
		<div class="sec-head">
			<h2 class="display h2">{i.tr('Aus der Werkstatt', 'Fresh from the shop')}</h2>
			<a class="link" href={i.href('/produkte')}>{i.tr('Alle Produkte', 'All products')}</a>
		</div>
		<div class="grid" use:reveal={{ group: true }}>
			{#each data.featured as p, n (p.id)}<ProductCard {p} eager={n < 4} />{/each}
		</div>
	</section>
{/if}

<section class="custom on-light">
	<div class="wrap custom-in">
		<div>
			<h2 class="display h2">{i.tr('Full Custom: so läuft’s', 'Full custom: how it works')}</h2>
			<p class="lead">{i.tr('Du hast eine Idee, wir machen daraus dein Dekor.', 'You bring the idea, we turn it into your graphics.')}</p>
		</div>
		<ol class="steps" use:reveal={{ group: true, stagger: 120 }}>
			<li>
				<strong>{i.tr('Anfrage & Anzahlung', 'Request & deposit')}</strong>
				<span>{i.tr('Bike, Farben und Wünsche angeben, Fotos hochladen, Anzahlung leisten.', 'Tell us your bike, colours and wishes, upload photos, pay the deposit.')}</span>
			</li>
			<li>
				<strong>{i.tr('Entwurf', 'Design')}</strong>
				<span>{i.tr('Wir gestalten und schicken dir den Entwurf in dein Konto.', 'We design and send the draft to your account.')}</span>
			</li>
			<li>
				<strong>{i.tr('Freigabe', 'Approval')}</strong>
				<span>{i.tr('Du gibst frei oder sagst uns, was wir ändern sollen.', 'Approve it or tell us what to change.')}</span>
			</li>
			<li>
				<strong>{i.tr('Druck & Versand', 'Print & ship')}</strong>
				<span>{i.tr('Nach der Restzahlung drucken wir und schicken dir dein Dekor.', 'After the remaining payment we print and ship your graphics.')}</span>
			</li>
		</ol>
		<a class="btn" href={i.href('/kategorie/full-custom')}>{i.tr('Jetzt starten', 'Get started')}</a>
	</div>
</section>

{#if data.newest.length}
	<section class="wrap section">
		<div class="sec-head">
			<h2 class="display h2">{i.tr('Neu im Shop', 'New in')}</h2>
		</div>
		<div class="grid" use:reveal={{ group: true }}>
			{#each data.newest as p (p.id)}<ProductCard {p} />{/each}
		</div>
	</section>
{/if}

{#if data.gallery.length}
	<section class="section gallery-sec">
		<div class="wrap sec-head">
			<h2 class="display h2">{i.tr('Kundenbikes', 'Customer bikes')}</h2>
		</div>
		<ul class="gallery" use:reveal={{ group: true, variant: 'cut', stagger: 110 }} aria-label={i.tr('Kundenbikes', 'Customer bikes')}>
			{#each data.gallery as g (g.id)}
				<li>
					<figure>
						<Picture media={g.image} sizes="(min-width: 1024px) 30vw, 80vw" want={900} />
						{#if g.title || g.bike}<figcaption><strong>{g.title}</strong>{#if g.bike}<span class="muted"> {g.bike}</span>{/if}</figcaption>{/if}
					</figure>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.reviews.length}
	<section class="wrap section">
		<h2 class="display h2">{i.tr('Das sagen Fahrer', 'What riders say')}</h2>
		<div class="reviews" use:reveal={{ group: true, stagger: 110 }}>
			{#each data.reviews as r (r.id)}
				<figure class="review">
					<span class="stars" aria-label={i.tr(`${r.rating} von 5 Sternen`, `${r.rating} out of 5 stars`)}>
						{#each Array(5) as _, n (n)}<Star size={16} fill={n < r.rating ? 'currentColor' : 'none'} />{/each}
					</span>
					<blockquote>{r.text}</blockquote>
					<figcaption><strong>{r.name}</strong>{#if r.bike}<span class="muted"> · {r.bike}</span>{/if}</figcaption>
				</figure>
			{/each}
		</div>
	</section>
{/if}

<style>
	.hero {
		position: relative;
		display: grid;
		min-height: min(88svh, 52rem);
		overflow: hidden;
	}
	.hero-img {
		--cut: 7rem;
		position: absolute;
		inset: 0;
		background: #18181b;
	}
	/* Einstieg: ein abgestimmter Ablauf – Bild wird freigewischt, Zeilen steigen auf, Strich zieht sich, Knöpfe folgen */
	.hero-media {
		position: absolute;
		inset: 0;
		animation: wipe 1300ms var(--ease-expo) 100ms both;
	}
	.hero-img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 60% 45%;
		animation: settle 2400ms var(--ease-expo) 100ms both;
	}
	@keyframes wipe {
		from {
			clip-path: polygon(-12% 0, 0 0, -12% 100%, -12% 100%);
		}
		to {
			clip-path: polygon(-12% 0, 112% 0, 100% 100%, -12% 100%);
		}
	}
	@keyframes settle {
		from {
			transform: scale(1.14);
		}
	}
	/* Mitte des Streifens läuft genau auf der Wischkante (gleiche Kurve und Dauer) */
	.sweep {
		position: absolute;
		z-index: 2;
		top: -5%;
		bottom: -5%;
		left: 0;
		width: 14%;
		background: var(--grad);
		pointer-events: none;
		animation:
			sweep-move 1300ms var(--ease-expo) 100ms both,
			sweep-fade 1300ms linear 100ms both;
	}
	@keyframes sweep-move {
		from {
			transform: translateX(-93%) skewX(-12deg);
		}
		to {
			transform: translateX(707%) skewX(-12deg);
		}
	}
	@keyframes sweep-fade {
		0%,
		55% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
	.hero-img::after {
		content: '';
		position: absolute;
		z-index: 1;
		inset: 0;
		background:
			linear-gradient(to top, #000 0%, rgb(0 0 0 / 0.72) 45%, rgb(0 0 0 / 0.35) 75%, rgb(0 0 0 / 0.15) 100%),
			linear-gradient(to right, rgb(0 0 0 / 0.45), transparent 70%);
	}
	@media (min-width: 1024px) {
		.hero-img {
			left: 34%;
		}
		.hero-img::after {
			background: linear-gradient(to right, #000 0%, rgb(0 0 0 / 0.8) 22%, rgb(0 0 0 / 0.15) 50%, transparent 70%);
		}
	}
	.hero-text {
		position: relative;
		z-index: 1;
		align-self: end;
		padding-block: 3rem 3.25rem;
	}
	@media (min-width: 1024px) {
		.hero-text {
			align-self: center;
		}
	}
	h1 {
		display: flex;
		flex-direction: column;
		font-size: clamp(2.4rem, 1.2rem + 5.8vw, 5.6rem);
		max-width: 11ch;
	}
	.line + .line {
		margin-top: 0.06em;
	}
	/* Maske je Zeile; Innenabstand, damit Umlaute und Unterlängen nicht abgeschnitten werden */
	.line {
		display: block;
		overflow: hidden;
		padding: 0.12em 0.1em 0.04em 0;
		margin: -0.12em -0.1em -0.04em 0;
	}
	.line > span {
		display: block;
		animation: rise 1100ms var(--ease-expo) both;
		animation-delay: calc(420ms + var(--i) * 110ms);
	}
	@keyframes rise {
		from {
			transform: translateY(110%);
		}
	}
	.grad-bar {
		display: block;
		width: 7rem;
		height: 0.4rem;
		margin: 1.5rem 0 1.25rem;
		background: var(--grad);
		transform: skewX(-24deg);
		transform-origin: left;
		box-shadow: var(--glow);
		animation: draw 900ms var(--ease-expo) 800ms both;
	}
	@keyframes draw {
		from {
			transform: skewX(-24deg) scaleX(0);
		}
	}
	.hero-text .lead {
		animation: fade-up 900ms var(--ease-expo) 900ms both;
	}
	.ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.75rem;
		animation: fade-up 900ms var(--ease-expo) 1020ms both;
	}
	@keyframes fade-up {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
	}

	.finder {
		background: #18181b;
		border-block: 1px solid #27272a;
	}
	.finder-in {
		display: grid;
		gap: 1.25rem;
		padding-block: 1.75rem;
	}
	@media (min-width: 1024px) {
		.finder-in {
			grid-template-columns: 15rem 1fr auto;
			align-items: end;
		}
	}

	.cats {
		display: grid;
		gap: 1rem;
	}
	@media (min-width: 768px) {
		.cats {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.cat {
		position: relative;
		display: block;
		color: #fff;
		text-decoration: none;
	}
	.cat-img {
		--cut: 3rem;
		display: block;
		aspect-ratio: 4 / 5;
		background: #18181b;
		overflow: hidden;
	}
	.cat-img :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 900ms var(--ease-expo);
	}
	.cat:hover .cat-img :global(img) {
		transform: scale(1.05);
	}
	.cat-img::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(0 0 0 / 0.75), transparent 45%);
	}
	.cat-text {
		position: absolute;
		left: 1.25rem;
		bottom: 1.1rem;
		z-index: 1;
		display: flex;
		flex-direction: column;
	}
	.cat-name {
		font-size: clamp(1.5rem, 1rem + 1.6vw, 2.25rem);
	}
	/* Kurzer Verlaufs-Strich wie im Titelbereich, zieht sich beim Überfahren */
	.cat-text::after {
		content: '';
		width: 3.5rem;
		height: 0.3rem;
		margin-top: 0.7rem;
		background: var(--grad);
		transform: skewX(-24deg) scaleX(0.35);
		transform-origin: left;
		transition: transform 500ms var(--ease-expo);
	}
	.cat:hover .cat-text::after,
	.cat:focus-visible .cat-text::after {
		transform: skewX(-24deg);
	}

	.sec-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.75rem 1rem;
	}
	@media (min-width: 1024px) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2.25rem 1.5rem;
		}
	}

	.custom {
		background: #fff;
		color: #000;
	}
	.custom-in {
		display: grid;
		gap: 2rem;
		padding-block: 3.5rem;
	}
	@media (min-width: 1024px) {
		.custom-in {
			grid-template-columns: 1fr 1.6fr;
			align-items: start;
			padding-block: 5rem;
		}
		.custom-in > .btn {
			grid-column: 2;
			justify-self: start;
		}
	}
	.custom .lead {
		color: #3f3f46;
		margin-top: 0.75rem;
	}
	.custom .btn {
		justify-self: start;
	}
	.steps {
		display: grid;
		gap: 1.25rem;
		counter-reset: step;
	}
	@media (min-width: 640px) {
		.steps {
			grid-template-columns: 1fr 1fr;
		}
	}
	.steps li {
		position: relative;
		counter-increment: step;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-top: 1rem;
		border-top: 2px solid #e4e4e7;
	}
	/* Verlaufs-Linie zieht sich über die graue Linie, sobald der Schritt ins Bild kommt */
	.steps li::after {
		content: '';
		position: absolute;
		top: -2px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--grad);
		transform-origin: left;
	}
	.steps li:global(.rv)::after {
		transform: scaleX(0);
		transition: transform 1200ms var(--ease-expo) calc(var(--rv-delay, 0ms) + 250ms);
	}
	.steps li:global(.rv-in)::after {
		transform: none;
	}
	.steps li::before {
		content: counter(step);
		width: fit-content;
		font-size: 2.4rem;
		font-weight: 850;
		font-stretch: 125%;
		line-height: 1;
		background: var(--grad);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.steps strong {
		font-weight: 750;
		font-stretch: 110%;
		text-transform: uppercase;
	}
	.steps span {
		color: #3f3f46;
	}

	.gallery {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		padding: 0 1rem 1rem;
		scrollbar-width: thin;
	}
	@media (min-width: 1024px) {
		.gallery {
			padding-inline: max(2.25rem, calc((100vw - 82rem) / 2 + 2.25rem));
		}
	}
	.gallery li {
		flex: 0 0 min(80vw, 26rem);
		scroll-snap-align: start;
	}
	.gallery figure {
		overflow: hidden;
	}
	.gallery figure :global(img) {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		background: #18181b;
	}
	figcaption {
		margin-top: 0.6rem;
		font-size: 0.9rem;
	}

	.reviews {
		display: grid;
		gap: 1.25rem;
		margin-top: 1.75rem;
	}
	@media (min-width: 768px) {
		.reviews {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	.review {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.5rem;
		background: #18181b;
	}
	.stars {
		display: flex;
		gap: 0.15rem;
		color: #cc5de8;
	}
	blockquote {
		color: #d4d4d8;
		line-height: 1.6;
	}
</style>
