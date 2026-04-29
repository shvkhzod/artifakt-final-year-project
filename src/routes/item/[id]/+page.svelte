<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import * as appStore from '$lib/stores/appStore.svelte';
	import DissectSection from '$lib/components/shared/DissectSection.svelte';
	import { extractYouTubeId, youtubeEmbedUrl } from '$lib/utils/youtube';

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

	let confirmingDelete = $state(false);
	let deleting = $state(false);

	async function handleDelete() {
		if (!confirmingDelete) {
			confirmingDelete = true;
			return;
		}
		deleting = true;
		try {
			const res = await fetch(`/api/items/${data.item.id}`, { method: 'DELETE' });
			if (res.ok) {
				appStore.showToast('Item deleted', 'success');
				goto('/');
			} else {
				appStore.showToast('Failed to delete', 'error');
			}
		} catch {
			appStore.showToast('Failed to delete', 'error');
		} finally {
			deleting = false;
			confirmingDelete = false;
		}
	}

	function cancelDelete() {
		confirmingDelete = false;
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
		<div class="top-bar-actions">
			{#if confirmingDelete}
				<button class="delete-btn delete-btn--confirm" onclick={handleDelete} disabled={deleting}>
					{deleting ? 'Deleting...' : 'Confirm delete'}
				</button>
				<button class="delete-btn delete-btn--cancel" onclick={cancelDelete}>
					Cancel
				</button>
			{:else}
				<button class="delete-btn" onclick={handleDelete} aria-label="Delete item">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					</svg>
				</button>
			{/if}
		</div>
	</header>

	<main class="item-content">
		<!-- Item hero -->
		<div class="item-hero">
			{#if data.item.type === 'video'}
				{@const videoId = data.item.url ? extractYouTubeId(data.item.url) : null}
				{#if videoId}
					<div class="hero-video-wrap" style="view-transition-name: item-hero">
						<iframe
							src={youtubeEmbedUrl(videoId)}
							title={data.item.title || 'Video'}
							frameborder="0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
						></iframe>
					</div>
				{/if}
				{#if data.item.content}
					<p class="video-description">{data.item.content}</p>
				{/if}
			{:else if data.item.type === 'image' || data.item.type === 'screenshot'}
				{#if data.item.url || data.item.thumbnailUrl}
					<div class="hero-image-wrap" style="view-transition-name: item-hero">
						<img
							src={data.item.url || data.item.thumbnailUrl}
							alt={data.item.title || 'Saved image'}
							class="hero-image"
						/>
					</div>
				{/if}
			{:else if data.item.type === 'quote'}
				<div class="hero-quote" style="view-transition-name: item-hero">
					<span class="quote-mark">&ldquo;</span>
					<blockquote class="quote-text">{data.item.content}</blockquote>
					{#if data.item.note}
						<cite class="quote-author">&mdash; {data.item.note}</cite>
					{/if}
				</div>
			{:else if data.item.type === 'article'}
				<div class="hero-article" style="view-transition-name: item-hero">
					{#if data.item.title}
						<h1 class="article-title" style="view-transition-name: item-title">{data.item.title}</h1>
					{/if}
					{#if data.item.content}
						<p class="article-excerpt">{data.item.content}</p>
					{/if}
					{#if data.item.url}
						<a href={data.item.url} target="_blank" rel="noopener noreferrer" class="article-link">
							{extractDomain(data.item.url)}
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
			{#if data.item.title && data.item.type !== 'article'}
				<h1 class="item-title" style="view-transition-name: item-title">{data.item.title}</h1>
			{/if}

			<div class="meta-details">
				<span class="meta-type">{data.item.type}</span>
				<span class="meta-sep">&middot;</span>
				<span class="meta-date">{formatDate(data.item.createdAt)}</span>
			</div>

			{#if data.cluster}
				<div class="meta-cluster" style="--cluster-color: {data.cluster.color}; view-transition-name: item-cluster">
					<span class="cluster-dot"></span>
					<span class="cluster-name">{data.cluster.name}</span>
					<span class="cluster-confidence">
						{Math.round((data.cluster.confidence ?? 1) * 100)}% match
					</span>
				</div>
			{/if}
		</div>

		<!-- Tags -->
		{#if data.tags.length > 0}
			<div class="tags-section">
				{#each data.tags as tag (tag.id)}
					<span class="tag" class:tag-ai={tag.source === 'ai'}>
						{tag.name}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Note -->
		{#if data.item.note && data.item.type !== 'quote'}
			<div class="note-section">
				<h3 class="section-label">Note</h3>
				<p class="note-text">{data.item.note}</p>
			</div>
		{/if}

		<!-- Dissect -->
		<DissectSection
			itemId={data.item.id}
			dissectedAt={data.dissectedAt}
			initialFragments={data.fragments}
		/>
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
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.top-bar-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.delete-btn:hover {
		color: var(--cluster-vermillion);
		background: rgba(213, 94, 0, 0.08);
	}

	.delete-btn--confirm {
		color: var(--cluster-vermillion);
		background: rgba(213, 94, 0, 0.12);
		padding: 5px 12px;
	}

	.delete-btn--confirm:hover {
		background: rgba(213, 94, 0, 0.2);
	}

	.delete-btn--confirm:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.delete-btn--cancel {
		color: var(--text-tertiary);
	}

	.delete-btn--cancel:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
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

	/* ── Hero: Video ─────────────────────────────── */
	.hero-video-wrap {
		position: relative;
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin-bottom: var(--space-lg);
		aspect-ratio: 16 / 9;
		background: var(--bg-surface-1);
	}

	.hero-video-wrap iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.video-description {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
		margin-bottom: var(--space-lg);
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
