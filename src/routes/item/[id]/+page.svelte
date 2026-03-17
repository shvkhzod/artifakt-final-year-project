<script lang="ts">
	import type { PageData } from './$types';

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
</script>

<svelte:head>
	<title>{data.item.title || 'Item'} — Aina</title>
</svelte:head>

<div class="item-page">
	<!-- Top bar -->
	<header class="top-bar">
		<a href="/" class="back-link" aria-label="Back to Library">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="m15 18-6-6 6-6" />
			</svg>
			<span>Library</span>
		</a>
	</header>

	<main class="item-content">
		<!-- Item hero -->
		<div class="item-hero">
			{#if data.item.type === 'image' || data.item.type === 'screenshot'}
				{#if data.item.url || data.item.thumbnailUrl}
					<div class="hero-image-wrap">
						<img
							src={data.item.url || data.item.thumbnailUrl}
							alt={data.item.title || 'Saved image'}
							class="hero-image"
						/>
					</div>
				{/if}
			{:else if data.item.type === 'quote'}
				<div class="hero-quote">
					<span class="quote-mark">&ldquo;</span>
					<blockquote class="quote-text">{data.item.content}</blockquote>
					{#if data.item.note}
						<cite class="quote-author">&mdash; {data.item.note}</cite>
					{/if}
				</div>
			{:else if data.item.type === 'article'}
				<div class="hero-article">
					{#if data.item.title}
						<h1 class="article-title">{data.item.title}</h1>
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
				<h1 class="item-title">{data.item.title}</h1>
			{/if}

			<div class="meta-details">
				<span class="meta-type">{data.item.type}</span>
				<span class="meta-sep">&middot;</span>
				<span class="meta-date">{formatDate(data.item.createdAt)}</span>
			</div>

			{#if data.cluster}
				<div class="meta-cluster" style="--cluster-color: {data.cluster.color}">
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

		<!-- Similar items -->
		{#if data.similarItems.length > 0}
			<div class="similar-section">
				<h3 class="section-label">Similar Items</h3>
				<div class="similar-grid">
					{#each data.similarItems as similar (similar.id)}
						<a href="/item/{similar.id}" class="similar-card">
							{#if (similar.type === 'image' || similar.type === 'screenshot') && (similar.url || similar.thumbnailUrl)}
								<div class="similar-image-wrap">
									<img
										src={similar.url || similar.thumbnailUrl}
										alt={similar.title || 'Similar item'}
										loading="lazy"
									/>
								</div>
							{:else}
								<div class="similar-text-wrap">
									<span class="similar-type">{similar.type}</span>
									{#if similar.title}
										<span class="similar-title">{similar.title}</span>
									{/if}
								</div>
							{/if}
							<div class="similar-similarity">
								{Math.round(similar.similarity * 100)}%
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
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

	/* ── Similar Items ───────────────────────────── */
	.similar-section {
		margin-top: var(--space-2xl);
		padding-top: var(--space-xl);
		border-top: 1px solid var(--border-subtle);
	}

	.similar-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
	}

	.similar-card {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		text-decoration: none;
		transition: border-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.similar-card:hover {
		border-color: var(--border-light);
		transform: translateY(-2px);
	}

	.similar-image-wrap {
		aspect-ratio: 4 / 3;
		overflow: hidden;
	}

	.similar-image-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.similar-text-wrap {
		padding: var(--space-md);
		min-height: 100px;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.similar-type {
		font-size: var(--text-2xs);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--text-tertiary);
	}

	.similar-title {
		font-size: var(--text-sm);
		color: var(--text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.similar-similarity {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
		font-size: var(--text-2xs);
		font-weight: 500;
		color: var(--text-primary);
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		padding: 2px 8px;
		border-radius: var(--radius-full);
	}

	/* ── Responsive ──────────────────────────────── */
	@media (max-width: 640px) {
		.item-content {
			padding: var(--space-lg) var(--space-md) var(--space-2xl);
		}

		.similar-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.hero-quote {
			padding: var(--space-lg) var(--space-lg) var(--space-lg) var(--space-xl);
		}

		.quote-text {
			font-size: var(--text-lg);
		}
	}
</style>
