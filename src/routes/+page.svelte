<script lang="ts">
	import { goto } from '$app/navigation';
	import type { ItemType } from '$lib/utils/types';
	import { getClusterColor } from '$lib/utils/colors';
	import * as appStore from '$lib/stores/appStore.svelte';

	// Accept server data if available (from +page.server.ts)
	let { data }: { data?: { items?: any[]; clusters?: any[] } } = $props();

	interface GridItem {
		id: string;
		type: ItemType;
		title: string | null;
		content: string | null;
		url: string | null;
		thumbnailUrl: string | null;
		note: string | null;
		cluster: { id: string; name: string; color: string } | null;
	}

	interface ClusterInfo {
		id: string;
		name: string;
		color: string;
	}

	function makeCluster(name: string): { id: string; name: string; color: string } {
		const id = name.toLowerCase().replace(/\s+/g, '-');
		return { id, name, color: getClusterColor(name) };
	}

	const demoItems: GridItem[] = [
		{ id: '1', type: 'image', title: 'Morning Light on Concrete', content: null, url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '7', type: 'quote', title: 'On Simplicity', content: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', url: null, thumbnailUrl: null, note: 'Antoine de Saint-Exupéry', cluster: makeCluster('Design Philosophy') },
		{ id: '2', type: 'image', title: 'Foggy Mountain Ridge', content: null, url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '10', type: 'article', title: 'The Shape of Design', content: 'Frank Chimero explores how design is not just problem-solving but a way of contributing to the world.', url: 'shapeofdesignbook.com', thumbnailUrl: null, note: null, cluster: makeCluster('Design Philosophy') },
		{ id: '3', type: 'image', title: 'Tokyo Alleyway at Night', content: null, url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '11', type: 'article', title: 'Attention Is All You Need', content: 'The landmark paper introducing the Transformer architecture that revolutionized NLP.', url: 'arxiv.org', thumbnailUrl: null, note: null, cluster: makeCluster('Technology') },
		{ id: '8', type: 'quote', title: 'On Craft', content: 'The details are not the details. They make the design.', url: null, thumbnailUrl: null, note: 'Charles Eames', cluster: makeCluster('Design Philosophy') },
		{ id: '4', type: 'image', title: 'Minimalist Interior', content: null, url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '13', type: 'article', title: 'Local-First Software', content: 'A new paradigm that keeps data on the user\'s device while enabling collaboration.', url: 'inkandswitch.com', thumbnailUrl: null, note: null, cluster: makeCluster('Technology') },
		{ id: '9', type: 'quote', title: 'On Seeing', content: 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.', url: null, thumbnailUrl: null, note: 'Marcel Proust', cluster: makeCluster('Literature') },
		{ id: '5', type: 'image', title: 'Abstract Color Field', content: null, url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '14', type: 'screenshot', title: 'Linear App — Issue Board', content: null, url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400', thumbnailUrl: null, note: null, cluster: makeCluster('Technology') },
		{ id: '18', type: 'quote', title: 'On Technology', content: 'Any sufficiently advanced technology is indistinguishable from magic.', url: null, thumbnailUrl: null, note: 'Arthur C. Clarke', cluster: makeCluster('Technology') },
		{ id: '12', type: 'article', title: 'A Handmade Web', content: 'J.R. Carpenter argues for websites crafted with care, intention, and human touch.', url: 'luckysoap.com', thumbnailUrl: null, note: null, cluster: makeCluster('Design Philosophy') },
		{ id: '6', type: 'image', title: 'Weathered Typography', content: null, url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=200', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '15', type: 'quote', title: 'On Knowledge', content: 'The only true wisdom is in knowing you know nothing.', url: null, thumbnailUrl: null, note: 'Socrates', cluster: makeCluster('Literature') },
		{ id: '16', type: 'screenshot', title: 'VS Code — Monokai', content: null, url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300', thumbnailUrl: null, note: null, cluster: makeCluster('Technology') },
		{ id: '20', type: 'image', title: 'Light Study', content: null, url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', thumbnailUrl: null, note: null, cluster: makeCluster('Visual Aesthetics') },
		{ id: '19', type: 'article', title: 'How Buildings Learn', content: 'Stewart Brand on how buildings adapt and change over time, and what that teaches us about design.', url: 'goodreads.com', thumbnailUrl: null, note: null, cluster: makeCluster('Design Philosophy') },
		{ id: '21', type: 'article', title: 'The Garden and the Stream', content: 'Mike Caulfield on the difference between the garden (timeless, connected) and the stream (ephemeral, linear).', url: 'hapgood.us', thumbnailUrl: null, note: null, cluster: makeCluster('Literature') },
		{ id: '17', type: 'image', title: null, content: null, url: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200', thumbnailUrl: null, note: null, cluster: makeCluster('Technology') },
	];

	// Use server data if available, otherwise demo data
	let gridItems: GridItem[] = $derived(
		(data?.items && data.items.length > 0) ? data.items : demoItems
	);

	// Extract unique clusters for filter pills
	const allClusters = $derived.by(() => {
		const seen = new Map<string, ClusterInfo>();
		for (const item of gridItems) {
			if (item.cluster && !seen.has(item.cluster.id)) {
				seen.set(item.cluster.id, item.cluster);
			}
		}
		return Array.from(seen.values());
	});

	// Filtered items based on selected cluster
	const visibleItems = $derived.by(() => {
		if (!appStore.getSelectedClusterId()) return gridItems;
		return gridItems.filter((item) => item.cluster?.id === appStore.getSelectedClusterId());
	});

	// Track which card is transitioning — only that card gets view-transition-name.
	// Reads from shared store so back-navigation from Item Detail can tag the right card.
	let transitioningId: string | null = $derived(appStore.getViewTransitionItemId());

	function handleItemClick(itemId: string) {
		if (!document.startViewTransition) {
			goto(`/item/${itemId}`);
			return;
		}

		// Tag the clicked card, wait one frame for the DOM to update, then transition
		appStore.setViewTransitionItemId(itemId);
		requestAnimationFrame(() => {
			document.startViewTransition!(() => {
				appStore.setViewTransitionItemId(null);
				return goto(`/item/${itemId}`);
			});
		});
	}

	function extractDomain(url: string | null): string {
		if (!url) return '';
		try {
			return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		} catch {
			return url;
		}
	}

	// ── Drag and Drop ─────────────────────────────
	let isDragging: boolean = $state(false);
	let dragCounter: number = $state(0);

	function isURL(text: string): boolean {
		return /^https?:\/\/.+/i.test(text.trim());
	}

	async function saveFromInput(payload: Record<string, any> | FormData): Promise<any> {
		const isFormData = payload instanceof FormData;
		const response = await fetch('/api/items', {
			method: 'POST',
			...(isFormData
				? { body: payload }
				: { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
		});
		if (!response.ok) throw new Error('Save failed');
		return response.json();
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		dragCounter++;
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragCounter--;
		if (dragCounter <= 0) {
			isDragging = false;
			dragCounter = 0;
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		dragCounter = 0;

		const dt = e.dataTransfer;
		if (!dt) return;

		const imageFile = Array.from(dt.files).find((f) => f.type.startsWith('image/'));
		if (imageFile) {
			try {
				const formData = new FormData();
				formData.append('file', imageFile);
				formData.append('type', 'image');
				await saveFromInput(formData);
				appStore.showToast('Image saved to library', 'success');
			} catch {
				appStore.showToast('Failed to save image', 'error');
			}
			return;
		}

		const text = dt.getData('text/plain');
		const html = dt.getData('text/html');

		try {
			if (text && isURL(text)) {
				await saveFromInput({ url: text.trim(), type: 'article' });
				appStore.showToast('Link saved to library', 'success');
			} else if (html && html.trim().length > 0) {
				await saveFromInput({ content: text || html, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			} else if (text) {
				await saveFromInput({ content: text, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			}
		} catch {
			appStore.showToast('Failed to save', 'error');
		}
	}
</script>

<svelte:head>
	<title>Aina — Library</title>
</svelte:head>

<!-- Cluster filter pills -->
<div class="cluster-filters">
	<button
		class="filter-pill"
		class:active={!appStore.getSelectedClusterId()}
		onclick={() => appStore.selectCluster(null)}
	>
		All
	</button>
	{#each allClusters as cluster (cluster.id)}
		<button
			class="filter-pill"
			class:active={appStore.getSelectedClusterId() === cluster.id}
			style="--pill-accent: {cluster.color}"
			onclick={() => appStore.selectCluster(appStore.getSelectedClusterId() === cluster.id ? null : cluster.id)}
		>
			<span class="filter-dot" style="background: {cluster.color}"></span>
			{cluster.name}
		</button>
	{/each}
</div>

<!-- Grid Library -->
<div
	class="library"
	role="region"
	aria-label="Saved items"
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<div class="grid">
		{#each visibleItems as item (item.id)}
			{@const isTransitioning = transitioningId === item.id}
			{@const clusterCol = item.cluster?.color || 'rgba(255,255,255,0.06)'}
			<button
				class="grid-card"
				class:card-type-image={item.type === 'image' || item.type === 'screenshot'}
				class:card-type-quote={item.type === 'quote'}
				class:card-type-article={item.type === 'article'}
				style="--cluster-col: {clusterCol}"
				onclick={() => handleItemClick(item.id)}
			>
				{#if item.type === 'image' || item.type === 'screenshot'}
					<div class="card-image" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
						<img
							src={item.url || item.thumbnailUrl}
							alt={item.title || 'Saved image'}
							loading="lazy"
							draggable="false"
						/>
						<span class="image-edge" aria-hidden="true"></span>
					</div>
					{#if item.title}
						<span class="image-caption" style={isTransitioning ? 'view-transition-name: item-title' : ''}>{item.title}</span>
					{/if}
				{:else if item.type === 'quote'}
					<div class="card-quote" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
						<p class="quote-text">{item.content}</p>
						{#if item.note}
							<span class="quote-author">{item.note}</span>
						{/if}
					</div>
				{:else if item.type === 'article'}
					<div class="card-article" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
						<h4 class="article-title" style={isTransitioning ? 'view-transition-name: item-title' : ''}>{item.title}</h4>
						{#if item.content}
							<p class="article-desc">{item.content}</p>
						{/if}
						{#if item.url}
							<span class="article-source">{extractDomain(item.url)}</span>
						{/if}
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>

{#if isDragging}
	<div class="drop-overlay">
		<div class="drop-message">
			<div class="drop-icon">+</div>
			Drop to save
		</div>
	</div>
{/if}

<!-- Floating add button -->
<button class="fab" aria-label="Add new item" onclick={() => appStore.openQuickAdd()}>
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</svg>
</button>

<style>
	/* ── Cluster Filters ─────────────────────────── */
	.cluster-filters {
		position: fixed;
		top: calc(var(--navbar-height) + var(--space-xl));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-panel);
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs);
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
	}

	.filter-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: 5px 14px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-tertiary);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.filter-pill:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
	}

	.filter-pill.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	.filter-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	/* ── Library ─────────────────────────────────── */
	.library {
		min-height: 100vh;
		padding: calc(var(--navbar-height) + var(--space-3xl)) var(--space-lg) var(--space-3xl);
		background: var(--bg-void);
	}

	/* ── Masonry Grid ────────────────────────────── */
	.grid {
		columns: 4;
		column-gap: 20px;
		max-width: 1400px;
		margin: 0 auto;
	}

	/* ── Card (shared base) ──────────────────────── */
	.grid-card {
		position: relative;
		display: block;
		width: 100%;
		break-inside: avoid;
		margin-bottom: 20px;
		border: none;
		padding: 0;
		background: transparent;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		outline: none;
	}

	/* Keyboard focus — subtle ring in sage */
	.grid-card:focus-visible {
		outline: 2px solid var(--accent-sage);
		outline-offset: 4px;
		border-radius: 4px;
	}

	/* ─────────────────────────────────────────────
	   IMAGE / SCREENSHOT CARDS
	   Gallery prints. Crisp edges. The image
	   carries all the visual weight.
	   ───────────────────────────────────────────── */
	.card-type-image .card-image {
		position: relative;
		line-height: 0;
		border-radius: 4px;
		overflow: hidden;
		/* Vignette gives depth, like a printed photograph */
		box-shadow: inset 0 -40px 40px -30px rgba(0, 0, 0, 0.25);
	}

	.card-type-image .card-image img {
		width: 100%;
		display: block;
		object-fit: cover;
		transition: transform 600ms var(--ease-out);
	}

	/* Bottom edge — cluster color bleeds in on hover */
	.image-edge {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--cluster-col);
		opacity: 0;
		transition: opacity 400ms var(--ease-out);
	}

	.card-type-image:hover .image-edge {
		opacity: 0.8;
	}

	.card-type-image:hover .card-image img {
		transform: scale(1.025);
	}

	/* Caption — sits below, whisper-quiet */
	.image-caption {
		display: block;
		padding: 8px 2px 0;
		font-family: var(--font-body);
		font-size: 11px;
		letter-spacing: 0.02em;
		color: var(--text-ghost);
		transition: color 400ms var(--ease-out);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-type-image:hover .image-caption {
		color: var(--text-tertiary);
	}

	/* ─────────────────────────────────────────────
	   QUOTE CARDS
	   Editorial typography. The words are the art.
	   A subtle surface gives them presence without
	   boxing them in.
	   ───────────────────────────────────────────── */
	.card-quote {
		padding: 24px 20px 22px 20px;
		background: rgba(255, 255, 255, 0.018);
		border-radius: 4px;
		transition: background 400ms var(--ease-out);
	}

	.card-type-quote:hover .card-quote {
		background: rgba(255, 255, 255, 0.035);
	}

	.quote-text {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--text-base);
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.72);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 6;
		line-clamp: 6;
		-webkit-box-orient: vertical;
		overflow: hidden;
		transition: color 400ms var(--ease-out);
	}

	.card-type-quote:hover .quote-text {
		color: rgba(255, 255, 255, 0.85);
	}

	.quote-author {
		display: block;
		margin-top: 14px;
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	/* ─────────────────────────────────────────────
	   ARTICLE CARDS
	   Reading list. Serif title gives editorial
	   weight. A faint surface and top accent make
	   them feel placed, not dumped.
	   ───────────────────────────────────────────── */
	.card-article {
		padding: 18px 18px 16px;
		background: rgba(255, 255, 255, 0.015);
		border-radius: 4px;
		transition: background 300ms var(--ease-out);
	}

	.card-type-article:hover .card-article {
		background: rgba(255, 255, 255, 0.03);
	}

	.article-title {
		font-family: var(--font-display);
		font-size: var(--text-base);
		font-weight: 400;
		color: var(--text-primary);
		line-height: 1.35;
		margin-bottom: 8px;
		transition: color 300ms var(--ease-out);
	}

	.card-type-article:hover .article-title {
		color: #fff;
	}

	.article-desc {
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.55;
		color: var(--text-tertiary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0 0 10px;
	}

	.article-source {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		color: var(--text-ghost);
		transition: color 300ms var(--ease-out);
	}

	.card-type-article:hover .article-source {
		color: var(--text-tertiary);
	}

	/* ── FAB ─────────────────────────────────────── */
	.fab {
		position: fixed;
		bottom: var(--space-xl);
		right: var(--space-xl);
		z-index: var(--z-fab);
		width: 52px;
		height: 52px;
		border-radius: var(--radius-full);
		border: none;
		background: var(--accent-sage);
		color: var(--text-on-accent);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 20px -2px rgba(123, 158, 135, 0.35);
		transition: transform var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.fab:hover {
		transform: scale(1.08);
		box-shadow: 0 6px 28px -2px rgba(123, 158, 135, 0.5);
	}

	.fab:active {
		transform: scale(0.96);
	}

	/* ── Drop Overlay ───────────────────────────── */
	.drop-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: grid;
		place-items: center;
		z-index: var(--z-drop-overlay);
		backdrop-filter: blur(8px);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	.drop-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		color: var(--text-primary);
		font-family: var(--font-display);
		font-size: var(--text-2xl);
	}

	.drop-icon {
		width: 64px;
		height: 64px;
		border: 2px dashed var(--border-light);
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		font-size: var(--text-xl);
		color: var(--text-secondary);
	}

	/* ── Responsive ──────────────────────────────── */
	@media (max-width: 1200px) {
		.grid {
			columns: 3;
		}
	}

	@media (max-width: 768px) {
		.grid {
			columns: 2;
			column-gap: 14px;
		}

		.grid-card {
			margin-bottom: 14px;
		}

		.library {
			padding: calc(var(--navbar-height) + var(--space-2xl)) var(--space-sm) var(--space-2xl);
		}

		.card-quote {
			padding: 18px 14px 16px 16px;
		}

		.card-article {
			padding: 14px 12px 12px;
		}
	}

	@media (max-width: 480px) {
		.grid {
			columns: 1;
		}

		.cluster-filters {
			left: var(--space-sm);
			right: var(--space-sm);
			transform: none;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
		}

		.cluster-filters::-webkit-scrollbar {
			display: none;
		}
	}
</style>
