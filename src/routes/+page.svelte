<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import type { ItemType } from '$lib/utils/types';
	import * as appStore from '$lib/stores/appStore.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { isYouTubeUrl, extractYouTubeId, youtubeThumbnailUrl } from '$lib/utils/youtube';

	let prefersReducedMotion = false;
	let canHover = false;

	onMount(() => {
		appStore.setSearchContext({ page: 'library' });
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		canHover = window.matchMedia('(hover: hover)').matches;
	});

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

	// Use server data
	let gridItems: GridItem[] = $derived(data?.items ?? []);

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
				await invalidateAll();
			} catch {
				appStore.showToast('Failed to save image', 'error');
			}
			return;
		}

		const text = dt.getData('text/plain');
		const html = dt.getData('text/html');

		try {
			if (text && isURL(text)) {
				const trimmed = text.trim();
				const type = isYouTubeUrl(trimmed) ? 'video' : 'article';
				await saveFromInput({ url: trimmed, type });
				appStore.showToast(type === 'video' ? 'Video saved to library' : 'Link saved to library', 'success');
			} else if (html && html.trim().length > 0) {
				await saveFromInput({ content: text || html, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			} else if (text) {
				await saveFromInput({ content: text, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			}
			await invalidateAll();
		} catch {
			appStore.showToast('Failed to save', 'error');
		}
	}

	// ── Overdrive: Scroll-driven reveal with stagger ──
	function reveal(node: HTMLElement, index: number) {
		if (prefersReducedMotion) {
			node.classList.add('revealed', 'tilt-ready');
			return { destroy() {} };
		}

		node.style.setProperty('--reveal-i', String(Math.min(index, 15)));

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const el = entry.target as HTMLElement;
						requestAnimationFrame(() => el.classList.add('revealed'));
						const staggerMs = Math.min(index, 15) * 50 + 550;
						setTimeout(() => el.classList.add('tilt-ready'), staggerMs);
						observer.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
		);

		observer.observe(node);
		return { destroy() { observer.disconnect(); } };
	}

	// ── Overdrive: 3D tilt on hover ───────────────────
	function tilt(node: HTMLElement) {
		if (prefersReducedMotion || !canHover) return { destroy() {} };

		let rafId: number;
		let active = false;
		let tx = 0, ty = 0, cx = 0, cy = 0;

		function animate() {
			cx += ((active ? tx : 0) - cx) * 0.1;
			cy += ((active ? ty : 0) - cy) * 0.1;

			if (Math.abs(cx) > 0.01 || Math.abs(cy) > 0.01) {
				node.style.transform = `perspective(600px) rotateX(${cx}deg) rotateY(${cy}deg)`;
				rafId = requestAnimationFrame(animate);
			} else if (!active) {
				node.style.transform = '';
			} else {
				rafId = requestAnimationFrame(animate);
			}
		}

		function onMove(e: MouseEvent) {
			if (!node.classList.contains('tilt-ready')) return;
			const r = node.getBoundingClientRect();
			const nx = (e.clientX - r.left) / r.width;
			const ny = (e.clientY - r.top) / r.height;
			ty = (nx - 0.5) * 6;
			tx = (0.5 - ny) * 6;
			if (!active) { active = true; rafId = requestAnimationFrame(animate); }
		}

		function onLeave() { active = false; }

		node.addEventListener('mousemove', onMove);
		node.addEventListener('mouseleave', onLeave);
		return {
			destroy() {
				cancelAnimationFrame(rafId);
				node.removeEventListener('mousemove', onMove);
				node.removeEventListener('mouseleave', onLeave);
			}
		};
	}

	// ── Overdrive: Spring physics FAB ─────────────────
	function springEl(node: HTMLElement) {
		if (prefersReducedMotion) return { destroy() {} };

		let s = 1, v = 0, target = 1;
		let rafId: number;
		let running = false;

		function step() {
			const f = -300 * (s - target) - 20 * v;
			v += f / 60;
			s += v / 60;
			node.style.transform = `scale(${s})`;

			if (Math.abs(s - target) > 0.001 || Math.abs(v) > 0.01) {
				rafId = requestAnimationFrame(step);
			} else {
				s = target;
				node.style.transform = target === 1 ? '' : `scale(${target})`;
				running = false;
			}
		}

		function go(t: number) {
			target = t;
			if (!running) { running = true; rafId = requestAnimationFrame(step); }
		}

		const onEnter = () => go(1.12);
		const onLeave = () => go(1);
		const onDown = () => { v = -3; go(0.88); };
		const onUp = () => go(1.12);

		node.addEventListener('mouseenter', onEnter);
		node.addEventListener('mouseleave', onLeave);
		node.addEventListener('mousedown', onDown);
		node.addEventListener('mouseup', onUp);

		return {
			destroy() {
				cancelAnimationFrame(rafId);
				node.removeEventListener('mouseenter', onEnter);
				node.removeEventListener('mouseleave', onLeave);
				node.removeEventListener('mousedown', onDown);
				node.removeEventListener('mouseup', onUp);
			}
		};
	}
</script>

<svelte:head>
	<title>Artifakt — Library</title>
</svelte:head>

{#if allClusters.length > 0}
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
{:else if gridItems.length > 0}
	<p class="taste-hint">Save more items to discover your taste patterns</p>
{/if}

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
	{#if visibleItems.length === 0}<EmptyState heading="Your collection is empty" subtitle="Save your first item to get started" />{:else}
	<div class="grid">
		{#each visibleItems as item, i (item.id)}
			{@const isTransitioning = transitioningId === item.id}
			{@const clusterCol = item.cluster?.color || 'rgba(255,255,255,0.06)'}
			<button
				class="grid-card"
				class:card-type-video={item.type === 'video'}
				class:card-type-image={item.type === 'image' || item.type === 'screenshot'}
				class:card-type-quote={item.type === 'quote'}
				class:card-type-article={item.type === 'article'}
				style="--cluster-col: {clusterCol}"
				onclick={() => handleItemClick(item.id)}
				use:reveal={i}
				use:tilt
			>
				{#if item.type === 'video'}
					{@const videoId = item.url ? extractYouTubeId(item.url) : null}
					<div class="card-video" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
						<img
							src={item.thumbnailUrl || (videoId ? youtubeThumbnailUrl(videoId) : '')}
							alt={item.title || 'Saved video'}
							loading="lazy"
							draggable="false"
						/>
						<div class="video-play" aria-hidden="true">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						</div>
						<span class="image-edge" aria-hidden="true"></span>
					</div>
					{#if item.title}
						<span class="video-caption" style={isTransitioning ? 'view-transition-name: item-title' : ''}>{item.title}</span>
					{/if}
					{#if item.content}
						<span class="video-desc">{item.content}</span>
					{/if}
				{:else if item.type === 'image' || item.type === 'screenshot'}
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
	{/if}
</div>

{#if isDragging}
	<div
		class="drop-overlay"
		ondragover={handleDragOver}
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<div class="drop-message">
			<div class="drop-icon">+</div>
			Drop to save
		</div>
	</div>
{/if}

<!-- Floating add button -->
<button class="fab" aria-label="Add new item" onclick={() => appStore.openQuickAdd()} use:springEl>
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

	/* ── Taste Hint (no clusters yet) ───────────── */
	.taste-hint {
		position: fixed;
		top: calc(var(--navbar-height) + var(--space-xl));
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-panel);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		color: var(--text-ghost);
		letter-spacing: 0.02em;
		white-space: nowrap;
		margin: 0;
	}

	/* ── Library ─────────────────────────────────── */
	.library {
		margin-top: var(--space-2xl);
		min-height: 100vh;
		padding: var(--space-3xl)+220px var(--space-3xl)+220px;
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
		/* Overdrive: start hidden for scroll reveal */
		opacity: 0;
		transform: translateY(20px) scale(0.98);
		transition:
			opacity 500ms var(--ease-out) calc(var(--reveal-i, 0) * 50ms),
			transform 500ms cubic-bezier(0, 0, 0.2, 1) calc(var(--reveal-i, 0) * 50ms);
	}

	/* Overdrive: revealed by IntersectionObserver
	   :global() prevents Svelte from stripping these —
	   the classes are added via JS classList, not template bindings */
	.grid-card:global(.revealed) {
		opacity: 1;
		transform: none;
	}

	/* Overdrive: after reveal, kill CSS transition so JS tilt runs at 60fps */
	.grid-card:global(.tilt-ready) {
		transition: none;
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
	   VIDEO CARDS
	   Thumbnail with a centered play icon.
	   Shares image card structure with a play
	   indicator layered on top.
	   ───────────────────────────────────────────── */
	.card-video {
		position: relative;
		line-height: 0;
		border-radius: 4px;
		overflow: hidden;
		box-shadow: inset 0 -40px 40px -30px rgba(0, 0, 0, 0.25);
	}

	.card-video img {
		width: 100%;
		display: block;
		object-fit: cover;
		aspect-ratio: 16 / 9;
		transition: transform 600ms var(--ease-out);
	}

	.video-play {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		color: #fff;
		opacity: 0.85;
		transition: opacity 300ms var(--ease-out), transform 300ms var(--ease-out);
	}

	.grid-card:hover .video-play {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1.08);
	}

	.grid-card:hover .card-video img {
		transform: scale(1.025);
	}

	.video-caption {
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

	.grid-card:hover .video-caption {
		color: var(--text-tertiary);
	}

	.video-desc {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		padding: 4px 2px 0;
		font-family: var(--font-body);
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-ghost);
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

	/* ── FAB (spring physics via JS, shadow via CSS) ── */
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
		transition: box-shadow var(--duration-fast) var(--ease-out);
	}

	.fab:hover {
		box-shadow: 0 6px 28px -2px rgba(123, 158, 135, 0.5);
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

	/* ── Reduced motion: skip all overdrive effects ── */
	@media (prefers-reduced-motion: reduce) {
		.grid-card {
			opacity: 1 !important;
			transform: none !important;
			transition: none !important;
		}
	}
</style>
