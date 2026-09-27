<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import Bold from '@lucide/svelte/icons/bold';
	import FileText from '@lucide/svelte/icons/file-text';
	import Heading2 from '@lucide/svelte/icons/heading-2';
	import Heading3 from '@lucide/svelte/icons/heading-3';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Italic from '@lucide/svelte/icons/italic';
	import Link2 from '@lucide/svelte/icons/link-2';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Minus from '@lucide/svelte/icons/minus';
	import Pilcrow from '@lucide/svelte/icons/pilcrow';
	import Quote from '@lucide/svelte/icons/quote';
	import Redo2 from '@lucide/svelte/icons/redo-2';
	import Underline from '@lucide/svelte/icons/underline';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { mediaSrc } from '$lib/media';
	import MediaLibrary from './MediaLibrary.svelte';

	interface Props {
		name: string;
		value?: string;
		placeholder?: string;
		label?: string;
	}

	let { name, value = '', placeholder = 'Text schreiben …', label = 'Text' }: Props = $props();

	let el: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	// svelte-ignore state_referenced_locally
	let html = $state(value);
	/** Wird bei jeder Änderung hochgezählt, damit die Knöpfe ihren Zustand neu prüfen */
	let tick = $state(0);
	let libOpen = $state(false);
	let docOpen = $state(false);

	/** PDF verlinken: markierter Text wird zum Link, sonst wird der Dateiname eingefügt */
	function insertDocument(doc: { file: string; originalName?: string }) {
		if (!editor) return;
		const href = `/medien/${doc.file}`;
		const { empty } = editor.state.selection;
		if (!empty) {
			editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
			return;
		}
		const label = (doc.originalName || 'Dokument').replace(/\.pdf$/i, '');
		editor
			.chain()
			.focus()
			.insertContent([
				{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] },
				{ type: 'text', text: ' ' }
			])
			.run();
	}

	onMount(async () => {
		// Editor erst im Browser laden – spart Gewicht beim Server-Rendering
		const [{ Editor }, { default: StarterKit }, { default: Image }, { Placeholder }] = await Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit'),
			import('@tiptap/extension-image'),
			import('@tiptap/extensions')
		]);
		editor = new Editor({
			element: el,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3] },
					code: false,
					codeBlock: false,
					link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
				}),
				Image,
				Placeholder.configure({ placeholder })
			],
			content: value,
			editorProps: { attributes: { class: 'prose rte-content', 'aria-label': label } },
			onTransaction: () => tick++,
			onUpdate: ({ editor }) => {
				html = editor.isEmpty ? '' : editor.getHTML();
			}
		});
	});

	onDestroy(() => editor?.destroy());

	function is(n: string, attrs?: Record<string, unknown>) {
		void tick;
		return editor?.isActive(n, attrs) ?? false;
	}
	const canUndo = $derived.by(() => (void tick, editor?.can().undo() ?? false));
	const canRedo = $derived.by(() => (void tick, editor?.can().redo() ?? false));
	const run = (fn: (e: Editor) => void) => () => {
		if (editor) fn(editor);
	};

	function setLink() {
		if (!editor) return;
		const prev = editor.getAttributes('link').href as string | undefined;
		const url = prompt('Adresse des Links (leer lassen zum Entfernen):', prev ?? 'https://');
		if (url === null) return;
		const chain = editor.chain().focus().extendMarkRange('link');
		if (!url.trim() || url.trim() === 'https://') chain.unsetLink().run();
		else chain.setLink({ href: url.trim() }).run();
	}
</script>

<div class="rte">
	<div class="bar" role="toolbar" aria-label="Textformat">
		<button type="button" class:on={is('paragraph')} onclick={run((e) => e.chain().focus().setParagraph().run())} title="Normaler Text"><Pilcrow size={17} /></button>
		<button type="button" class:on={is('heading', { level: 2 })} onclick={run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())} title="Zwischenüberschrift"><Heading2 size={17} /></button>
		<button type="button" class:on={is('heading', { level: 3 })} onclick={run((e) => e.chain().focus().toggleHeading({ level: 3 }).run())} title="Kleine Überschrift"><Heading3 size={17} /></button>
		<span class="sep"></span>
		<button type="button" class:on={is('bold')} onclick={run((e) => e.chain().focus().toggleBold().run())} title="Fett"><Bold size={17} /></button>
		<button type="button" class:on={is('italic')} onclick={run((e) => e.chain().focus().toggleItalic().run())} title="Kursiv"><Italic size={17} /></button>
		<button type="button" class:on={is('underline')} onclick={run((e) => e.chain().focus().toggleUnderline().run())} title="Unterstrichen"><Underline size={17} /></button>
		<button type="button" class:on={is('link')} onclick={setLink} title="Link"><Link2 size={17} /></button>
		<span class="sep"></span>
		<button type="button" class:on={is('bulletList')} onclick={run((e) => e.chain().focus().toggleBulletList().run())} title="Aufzählung"><List size={17} /></button>
		<button type="button" class:on={is('orderedList')} onclick={run((e) => e.chain().focus().toggleOrderedList().run())} title="Nummerierte Liste"><ListOrdered size={17} /></button>
		<button type="button" class:on={is('blockquote')} onclick={run((e) => e.chain().focus().toggleBlockquote().run())} title="Zitat"><Quote size={17} /></button>
		<button type="button" onclick={run((e) => e.chain().focus().setHorizontalRule().run())} title="Trennlinie"><Minus size={17} /></button>
		<button type="button" onclick={() => (libOpen = true)} title="Bild einfügen"><ImageIcon size={17} /></button>
		<button type="button" onclick={() => (docOpen = true)} title="PDF-Dokument verlinken"><FileText size={17} /></button>
		<span class="sep"></span>
		<button type="button" onclick={run((e) => e.chain().focus().undo().run())} title="Rückgängig" disabled={!canUndo}><Undo2 size={17} /></button>
		<button type="button" onclick={run((e) => e.chain().focus().redo().run())} title="Wiederholen" disabled={!canRedo}><Redo2 size={17} /></button>
	</div>
	<div bind:this={el} class="area">
		{#if !editor}<div class="prose rte-content loading">{@html value}</div>{/if}
	</div>
	<input type="hidden" {name} value={html} />
</div>

<MediaLibrary
	bind:open={libOpen}
	title="Bild in den Text einfügen"
	onselect={(items) => {
		const m = items[0];
		if (m && editor) editor.chain().focus().setImage({ src: mediaSrc(m, 1600), alt: m.alt }).run();
	}}
/>

<MediaLibrary bind:open={docOpen} kind="dokument" title="PDF-Dokument verlinken" onselect={(items) => items[0] && insertDocument(items[0])} />

<style>
	.rte {
		border: 1px solid var(--c-line-strong);
		border-radius: var(--radius-field);
		background: var(--c-surface);
	}
	.rte:focus-within {
		border-color: var(--c-focus);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-focus) 22%, transparent);
	}
	.bar {
		position: sticky;
		top: 3.5rem;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
		padding: 0.35rem;
		border-bottom: 1px solid var(--c-line);
		border-radius: var(--radius-field) var(--radius-field) 0 0;
		background: var(--c-surface-2);
	}
	@media (min-width: 1024px) {
		.bar {
			top: 0;
		}
	}
	.bar button {
		display: grid;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 7px;
		color: var(--c-ink-2);
	}
	.bar button:hover:not(:disabled) {
		background: var(--c-surface-3);
		color: var(--c-ink);
	}
	.bar button.on {
		background: var(--c-ink);
		color: #fff;
	}
	.bar button:disabled {
		opacity: 0.35;
	}
	.sep {
		width: 1px;
		margin: 0.35rem 0.2rem;
		background: var(--c-line-strong);
	}
	.area :global(.rte-content) {
		min-height: 14rem;
		max-width: none;
		padding: 1rem 1.1rem;
		outline: none;
	}
	.loading {
		opacity: 0.6;
	}
	.area :global(.rte-content img) {
		max-width: min(100%, 36rem);
	}
	.area :global(.rte-content img.ProseMirror-selectednode) {
		outline: 3px solid var(--c-accent);
	}
	.area :global(p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		color: var(--c-ink-3);
		pointer-events: none;
	}
</style>
