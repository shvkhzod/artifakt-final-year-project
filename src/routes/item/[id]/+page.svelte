<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import * as appStore from '$lib/stores/appStore.svelte';
	import ExplorationPaths from '$lib/components/shared/ExplorationPaths.svelte';
	import ExplorationBreadcrumbs from '$lib/components/shared/ExplorationBreadcrumbs.svelte';

	let { data }: { data: PageData } = $props();

	function extractDomain(url: string | null): string {
		if (!url) return '';
		try {
			return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		} catch {
			return url;
		}
	}

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}

	let exploringItemId: string | null = $state(null);
	let explorationTrail: Array<{ id: string; title: string | null; type: string }> = $state([]);
	let exploringItemData: any = $state(null);

	// The "active" item is either the exploring one or the server-loaded one
	let activeItem = $derived(exploringItemData?.item ?? data.item);
	let activeCluster = $derived(exploringItemData?.cluster ?? data.cluster);
	let activeTags = $derived(exploringItemData?.tags ?? data.tags);

	function handleExplore(detail: { id: string; title: string | null; type: string }) {
		const current = exploringItemData?.item ?? data.item;
		explorationTrail = [...explorationTrail, { id: current.id, title: current.title, type: current.type }];
		exploringItemId = detail.id;
		history.replaceState(null, '', `/item/${detail.id}`);
		fetchItemData(detail.id);
	}

	function handleBreadcrumbNavigate(id: string, index: number) {
		explorationTrail = explorationTrail.slice(0, index);
		exploringItemId = id;
		history.replaceState(null, '', `/item/${id}`);
		fetchItemData(id);
	}

	async function fetchItemData(id: string) {
		try {
			const res = await fetch(`/api/items/${id}`);
			if (res.ok) {
				const item = await res.json();
				exploringItemData = { item, cluster: null, tags: [], similarItems: [] };
			}
		} catch (e) {
			console.error('Failed to fetch item:', e);
		}
	}

	onMount(() => {
		appStore.setSearchContext({ page: 'item', itemId: data.item.id });
	});

	function handleBack(e: MouseEvent) {
		e.preventDefault();
		if (!document.startViewTransition) {
			goto('/');
			return;
		}
		// Tell the Library page which card to tag for the reverse morph
		appStore.setViewTransitionItemId(data.item.id);
		document.startViewTransition(() => goto('/'));
	}
</script>

<svelte:head>
	<title>{data.item.title || 'Item'} — Aina</title>
</svelte:head>

<div class="item-page">
	<!-- Top bar -->
	<header class="top-bar">
		<a href="/" class="back-link" aria-label="Back to Library" onclick={handleBack}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="m15 18-6-6 6-6" />
			</svg>
			<span>Library</span>
		</a>
	</header>

	<main class="item-content">
		<!-- Item hero -->
		<div class="item-hero">
			{#if activeItem.type === 'image' || activeItem.type === 'screenshot'}
				{#if activeItem.url || activeItem.thumbnailUrl}
					<div class="hero-image-wrap" style="view-transition-name: item-hero">
						<img
							src={activeItem.url || activeItem.thumbnailUrl}
							alt={activeItem.title || 'Saved image'}
							class="hero-image"
						/>
					</div>
				{/if}
			{:else if activeItem.type === 'quote'}
				<div class="hero-quote" style="view-transition-name: item-hero">
					<span class="quote-mark">&ldquo;</span>
					<blockquote class="quote-text">{activeItem.content}</blockquote>
					{#if activeItem.note}
						<cite class="quote-author">&mdash; {activeItem.note}</cite>
					{/if}
				</div>
			{:else if activeItem.type === 'article'}
				<div class="hero-article" style="view-transition-name: item-hero">
					{#if activeItem.title}
						<h1 class="article-title" style="view-transition-name: item-title">{activeItem.title}</h1>
					{/if}
					{#if activeItem.content}
						<p class="article-excerpt">{activeItem.content}</p>
					{/if}
					{#if activeItem.url}
						<a href={activeItem.url} target="_blank" rel="noopener noreferrer" class="article-link">
							{extractDomain(activeItem.url)}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
								<polyline points="15 3 21 3 21 9" />
								<line x1="10" y1="14" x2="21" y2="3" />
							</svg>
						</a>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Meta row -->
		<div class="meta-row">
			{#if activeItem.title && activeItem.type !== 'article'}
				<h1 class="item-title" style="view-transition-name: item-title">{activeItem.title}</h1>
			{/if}

			<div class="meta-details">
				<span class="meta-type">{activeItem.type}</span>
				<span class="meta-sep">&middot;</span>
				<span class="meta-date">{formatDate(activeItem.createdAt)}</span>
			</div>

			{#if activeCluster}
				<div class="meta-cluster" style="--cluster-color: {activeCluster.color}; view-transition-name: item-cluster">
					<span class="cluster-dot"></span>
					<span class="cluster-name">{activeCluster.name}</span>
					<span class="cluster-confidence">
						{Math.round((activeCluster.confidence ?? 1) * 100)}% match
					</span>
				</div>
			{/if}
		</div>

		<!-- Tags -->
		{#if activeTags.length > 0}
			<div class="tags-section">
				{#each activeTags as tag (tag.id)}
					<span class="tag" class:tag-ai={tag.source === 'ai'}>
						{tag.name}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Note -->
		{#if activeItem.note && activeItem.type !== 'quote'}
			<div class="note-section">
				<h3 class="section-label">Note</h3>
				<p class="note-text">{activeItem.note}</p>
			</div>
		{/if}

		<!-- Exploration -->
		{#if explorationTrail.length > 0}
			<ExplorationBreadcrumbs
				trail={explorationTrail}
				onnavigate={handleBreadcrumbNavigate}
			/>
		{/if}

		<div class="exploration-section">
			<ExplorationPaths
				itemId={exploringItemId ?? data.item.id}
				initialSemantic={!exploringItemId && data.similarItems?.length > 0 ? data.similarItems : undefined}
				oncenter={handleExplore}
			/>
		</div>
	</main>
</div>

<style>
	/* ── Page ─────────────────────────────────────── */
	.item-page {
		min-height: 100vh;
		background: var(--bg-void);
		color: var(--text-primary);
	}

	/* ── Top Bar ──────────────────────────────────── */
	.top-bar {
		position: sticky;
		top: 0;
		z-index: var(--z-drop-overlay);
		padding: var(--space-sm) var(--space-lg);
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(16px);
		border-bottom: 1px solid var(--border-subtle);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		text-decoration: none;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	/* ── Content ──────────────────────────────────── */
	.item-content {
		max-width: 720px;
		margin: 0 auto;
		padding: var(--space-xl) var(--space-lg) var(--space-3xl);
	}

	/* ── Hero: Image ─────────────────────────────── */
	.hero-image-wrap {
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-bottom: var(--space-lg);
	}

	.hero-image {
		width: 100%;
		display: block;
		max-height: 520px;
		object-fit: contain;
		background: var(--bg-surface-1);
	}

	/* ── Hero: Quote ─────────────────────────────── */
	.hero-quote {
		position: relative;
		padding: var(--space-xl) var(--space-xl) var(--space-xl) var(--space-2xl);
		margin-bottom: var(--space-lg);
		border-left: 3px solid var(--accent-sage);
		background: var(--bg-surface-2);
		border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
	}

	.quote-mark {
		font-family: var(--font-display);
		font-size: 64px;
		line-height: 1;
		color: var(--text-ghost);
		position: absolute;
		top: var(--space-md);
		left: var(--space-md);
	}

	.quote-text {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--text-xl);
		line-height: var(--leading-normal);
		color: var(--text-primary);
		margin: 0;
	}

	.quote-author {
		display: block;
		margin-top: var(--space-md);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		font-style: normal;
	}

	/* ── Hero: Article ───────────────────────────── */
	.hero-article {
		margin-bottom: var(--space-lg);
	}

	.article-title {
		color: var(--text-primary);
		margin-bottom: var(--space-md);
	}

	.article-excerpt {
		font-size: var(--text-base);
		color: var(--text-secondary);
		margin-bottom: var(--space-md);
	}

	.article-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--text-sm);
		color: var(--accent-sage);
		text-decoration: none;
		transition: opacity var(--duration-fast) var(--ease-out);
	}

	.article-link:hover {
		opacity: 0.8;
	}

	/* ── Meta Row ────────────────────────────────── */
	.meta-row {
		margin-bottom: var(--space-lg);
	}

	.item-title {
		font-size: var(--text-2xl);
		color: var(--text-primary);
		margin-bottom: var(--space-sm);
	}

	.meta-details {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		margin-bottom: var(--space-sm);
	}

	.meta-type {
		text-transform: capitalize;
	}

	.meta-sep {
		color: var(--text-ghost);
	}

	.meta-cluster {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
		padding: 4px 12px;
		border-radius: var(--radius-full);
	}

	.cluster-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--cluster-color);
	}

	.cluster-confidence {
		color: var(--text-tertiary);
		font-size: var(--text-xs);
	}

	/* ── Tags ────────────────────────────────────── */
	.tags-section {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		margin-bottom: var(--space-lg);
	}

	.tag {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
		padding: 4px 10px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
	}

	.tag-ai {
		border-color: rgba(123, 158, 135, 0.2);
	}

	/* ── Note ────────────────────────────────────── */
	.note-section {
		margin-bottom: var(--space-lg);
	}

	.section-label {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-tertiary);
		margin-bottom: var(--space-sm);
	}

	.note-text {
		font-size: var(--text-base);
		color: var(--text-secondary);
	}

	/* ── Exploration ────────────────────────────── */
	.exploration-section {
		margin-top: var(--space-2xl);
		padding-top: var(--space-xl);
		border-top: 1px solid var(--border-subtle);
	}

	/* ── Responsive ──────────────────────────────── */
	@media (max-width: 640px) {
		.item-content {
			padding: var(--space-lg) var(--space-md) var(--space-2xl);
		}

		.hero-quote {
			padding: var(--space-lg) var(--space-lg) var(--space-lg) var(--space-xl);
		}

		.quote-text {
			font-size: var(--text-lg);
		}
	}
</style>
