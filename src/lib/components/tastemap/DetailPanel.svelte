<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Item, Cluster } from '$lib/utils/types';
	import ArenaCard from '$lib/components/shared/ArenaCard.svelte';
	import type { ArenaBlock } from '$lib/utils/arena.types';

	interface Props {
		item: Item | null;
		cluster: Cluster | null;
		onClose?: () => void;
	}

	let { item, cluster, onClose }: Props = $props();

	let isOpen = $derived(item !== null);

	function viewFull() {
		if (item) {
			goto(`/item/${item.id}`);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose?.();
		}
	}

	function extractDomain(url: string | null): string {
		if (!url) return '';
		try {
			return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		} catch {
			return url;
		}
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		}).format(date);
	}

	/* Item type icons as SVG path data */
	const typeIcons: Record<string, string> = {
		image: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm15 10.59-3.54-3.54a1 1 0 0 0-1.41 0L9.17 17H19v-1.41zM5 17h1.76l6.37-6.37-2.3-2.3L5 14.17V17zM8.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		article:
			'M4 4h16v16H4V4zm2 3v2h12V7H6zm0 4v2h12v-2H6zm0 4v2h8v-2H6z',
		quote: 'M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z',
		screenshot:
			'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm2 0v14h14V5H5zm2 2h3v3H7V7zm7 0h3v3h-3V7z',
	};

	/* ── Explore (Are.na) ─────────────────────────── */
	let arenaEnabled = $state(true);
	let exploreLoading = $state(false);
	let exploreResults = $state<ArenaBlock[]>([]);
	let exploreError = $state('');
	let exploreTriggered = $state(false);

	let channelView = $state<{ slug: string; title: string } | null>(null);
	let channelBlocks = $state<ArenaBlock[]>([]);
	let channelLoading = $state(false);

	$effect(() => {
		if (item) {
			arenaEnabled = true;
			exploreTriggered = false;
			exploreResults = [];
			exploreError = '';
			channelView = null;
		}
	});

	async function handleExplore() {
		if (!item || exploreLoading) return;
		exploreTriggered = true;
		exploreLoading = true;
		exploreError = '';

		try {
			const res = await fetch('/api/explore', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId: item.id }),
			});

			if (res.status === 501) {
				arenaEnabled = false;
				return;
			}
			if (res.status === 425) {
				exploreError = 'Processing... try again shortly';
				return;
			}
			if (res.status === 429) {
				exploreError = 'Slow down — try again in a minute';
				return;
			}
			if (!res.ok) {
				exploreError = "Couldn't reach Are.na";
				return;
			}

			const data = await res.json();
			exploreResults = data.results ?? [];
			if (exploreResults.length === 0) {
				exploreError = 'No discoveries found';
			}
		} catch {
			exploreError = "Couldn't reach Are.na";
		} finally {
			exploreLoading = false;
		}
	}

	async function handleSeeChannel(slug: string) {
		const ch = exploreResults.flatMap(b => b.channels).find(c => c.slug === slug);
		channelView = { slug, title: ch?.title || slug };
		channelLoading = true;
		try {
			const res = await fetch(`/api/explore/channel/${encodeURIComponent(slug)}`);
			if (res.ok) {
				const data = await res.json();
				channelBlocks = data.blocks ?? [];
			}
		} catch {
			channelBlocks = [];
		} finally {
			channelLoading = false;
		}
	}

	function backToExploreResults() {
		channelView = null;
		channelBlocks = [];
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
{#if isOpen}
	<div
		class="backdrop"
		onclick={onClose}
		role="presentation"
	></div>
{/if}

<!-- Panel -->
<aside
	class="detail-panel"
	class:open={isOpen}
	aria-label="Item details"
>
	{#if item}
		<!-- Close button -->
		<button class="close-btn" onclick={onClose} aria-label="Close detail panel">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>

		<div class="panel-content">
			<!-- Type badge -->
			<div class="type-badge">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
					<path d={typeIcons[item.type] || typeIcons.article} />
				</svg>
				<span>{item.type}</span>
			</div>

			<!-- Image display -->
			{#if (item.type === 'image' || item.type === 'screenshot') && (item.url || item.thumbnailUrl)}
				<div class="image-container">
					<img
						src={item.url || item.thumbnailUrl}
						alt={item.title || 'Saved image'}
						loading="lazy"
					/>
				</div>
			{/if}

			<!-- Title -->
			{#if item.title}
				<h2 class="panel-title">
					{item.title}
				</h2>
			{/if}

			<!-- Quote content -->
			{#if item.type === 'quote' && item.content}
				<blockquote class="panel-quote">
					<p>{item.content}</p>
					{#if item.note}
						<cite>— {item.note}</cite>
					{/if}
				</blockquote>
			{/if}

			<!-- Article content -->
			{#if item.type === 'article' && item.content}
				<p class="panel-description">{item.content}</p>
			{/if}

			<!-- Source URL -->
			{#if item.url && item.type !== 'image'}
				<a
					class="source-link"
					href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
					target="_blank"
					rel="noopener noreferrer"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						<polyline points="15 3 21 3 21 9" />
						<line x1="10" y1="14" x2="21" y2="3" />
					</svg>
					<span>{extractDomain(item.url)}</span>
				</a>
			{/if}

			<!-- Cluster pill -->
			{#if cluster}
				<div class="cluster-section">
					<span class="section-label">Cluster</span>
					<span class="cluster-pill" style="--pill-color: {cluster.color}">
						{cluster.name}
					</span>
				</div>
			{/if}

			<!-- Date -->
			<div class="meta-section">
				<span class="section-label">Saved</span>
				<span class="meta-value">{formatDate(item.createdAt)}</span>
			</div>

			<!-- Note -->
			{#if item.note && item.type !== 'quote'}
				<div class="note-section">
					<span class="section-label">Note</span>
					<p class="note-text">{item.note}</p>
				</div>
			{/if}

			<!-- View full link -->
			<button class="view-full-btn" onclick={viewFull}>
				View full
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="m9 18 6-6-6-6" />
				</svg>
			</button>

			<!-- Explore (Are.na) -->
			{#if arenaEnabled}
				<button class="panel-btn explore-btn" onclick={handleExplore} disabled={exploreLoading}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10" />
						<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
					</svg>
					{exploreLoading ? 'Searching...' : 'Explore'}
				</button>
			{/if}

			{#if exploreTriggered}
				<div class="explore-results">
					{#if exploreLoading}
						<div class="explore-shimmer">
							{#each Array(3) as _}
								<div class="explore-shimmer-card"></div>
							{/each}
						</div>
					{:else if exploreError}
						<p class="explore-error">{exploreError}</p>
					{:else if channelView}
						<button class="explore-back" onclick={backToExploreResults}>&larr; Back to results</button>
						<p class="explore-channel-title">{channelView.title}</p>
						{#if channelLoading}
							<p class="explore-loading">Loading channel...</p>
						{:else}
							{#each channelBlocks as block (block.arenaId)}
								<ArenaCard {block} onseechannel={handleSeeChannel} />
							{/each}
						{/if}
					{:else}
						{#each exploreResults as block (block.arenaId)}
							<ArenaCard {block} onseechannel={handleSeeChannel} />
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	/* ── Backdrop ───────────────────────────────────── */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-sticky);
		background: rgba(0, 0, 0, 0.3);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	/* ── Panel ──────────────────────────────────────── */
	.detail-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: var(--z-panel);
		width: 360px;
		max-width: 100vw;
		background: var(--bg-surface-1);
		border-left: 1px solid var(--border-subtle);
		transform: translateX(100%);
		transition: transform var(--duration-normal) var(--ease-out);
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
	}

	.detail-panel.open {
		transform: translateX(0);
	}

	/* ── Close Button ──────────────────────────────── */
	.close-btn {
		position: absolute;
		top: var(--space-md);
		right: var(--space-md);
		z-index: 10;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	/* ── Panel Content ─────────────────────────────── */
	.panel-content {
		padding: var(--space-2xl) var(--space-lg) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	/* ── Type Badge ────────────────────────────────── */
	.type-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-tertiary);
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		width: fit-content;
	}

	/* ── Image ─────────────────────────────────────── */
	.image-container {
		width: 100%;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-void);
	}

	.image-container img {
		width: 100%;
		height: auto;
		display: block;
		object-fit: cover;
		max-height: 280px;
	}

	/* ── Title ─────────────────────────────────────── */
	.panel-title {
		font-size: var(--text-xl);
		font-weight: 400;
		color: var(--text-primary);
		line-height: var(--leading-snug);
		letter-spacing: -0.01em;
	}

	/* ── Quote ─────────────────────────────────────── */
	.panel-quote {
		padding: var(--space-md) 0;
		padding-left: var(--space-md);
		border-left: 2px solid var(--border-light);
	}

	.panel-quote p {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--text-primary);
	}

	.panel-quote cite {
		display: block;
		margin-top: var(--space-sm);
		font-style: normal;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}

	/* ── Description ───────────────────────────────── */
	.panel-description {
		font-size: var(--text-base);
		color: var(--text-secondary);
	}

	/* ── Source Link ────────────────────────────────── */
	.source-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--accent-sage);
		text-decoration: none;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.source-link:hover {
		color: var(--text-primary);
	}

	/* ── Cluster Pill ──────────────────────────────── */
	.cluster-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.section-label {
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.cluster-pill {
		display: inline-flex;
		align-items: center;
		padding: 3px var(--space-sm);
		border-radius: var(--radius-full);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--pill-color);
		background: color-mix(in srgb, var(--pill-color) 12%, transparent);
		width: fit-content;
	}

	/* ── Meta ───────────────────────────────────────── */
	.meta-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.meta-value {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	/* ── Note ───────────────────────────────────────── */
	.note-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.note-text {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		padding: var(--space-sm);
		background: rgba(255, 255, 255, 0.03);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-subtle);
	}

	/* ── Scrollbar ─────────────────────────────────── */
	.detail-panel::-webkit-scrollbar {
		width: 4px;
	}

	.detail-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.detail-panel::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
	}

	.detail-panel::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.14);
	}

	/* ── View Full Button ─────────────────────────── */
	.view-full-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		width: fit-content;
		transition: background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.view-full-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
		border-color: rgba(255, 255, 255, 0.15);
	}

	/* ── Responsive ──────────────────────────────── */
	@media (max-width: 768px) {
		.detail-panel {
			top: auto;
			left: 0;
			right: 0;
			bottom: 0;
			width: 100%;
			max-width: 100vw;
			max-height: 70vh;
			border-left: none;
			border-top: 1px solid var(--border-subtle);
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			transform: translateY(100%);
		}

		.detail-panel.open {
			transform: translateY(0);
		}
	}

	/* ── Explore ──────────────────────────────────── */
	.explore-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		margin-top: var(--space-xs);
		transition: border-color var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.explore-btn:hover:not(:disabled) {
		border-color: var(--accent-sage);
		color: var(--accent-sage);
	}

	.explore-btn:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.explore-results {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid var(--border-subtle);
	}

	.explore-results :global(.arena-card) {
		width: 100%;
	}

	.explore-results :global(.arena-card__image) {
		height: 120px;
	}

	.explore-shimmer {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.explore-shimmer-card {
		width: 100%;
		height: 120px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-2);
		animation: shimmer-pulse 1.2s var(--ease-in-out) infinite;
	}

	.explore-error {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		color: var(--text-ghost);
		margin: 0;
	}

	.explore-back {
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--text-tertiary);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.explore-back:hover {
		color: var(--text-primary);
	}

	.explore-channel-title {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 var(--space-xs);
	}

	.explore-loading {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		color: var(--text-ghost);
		margin: 0;
	}

	@keyframes shimmer-pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}
</style>
