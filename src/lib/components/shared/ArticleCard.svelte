<script lang="ts">
	interface Props {
		title: string;
		description: string;
		source: string;
		thumbnailUrl?: string;
		clusterColor?: 'amber' | 'cyan' | 'emerald' | 'blue' | 'vermillion' | 'mauve';
		tags?: string[];
	}

	let { title, description, source, thumbnailUrl, clusterColor, tags = [] }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.currentTarget as HTMLElement).click();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article class="article-card" tabindex="0" role="button" onkeydown={handleKeydown}>
	{#if thumbnailUrl}
		<div class="thumbnail">
			<img src={thumbnailUrl} alt={title || 'Article thumbnail'} loading="lazy" />
		</div>
	{/if}
	<div class="content">
		<div class="header">
			{#if clusterColor}
				<span class="cluster-dot" style="background: var(--cluster-{clusterColor})"></span>
			{/if}
			<h3 class="title">{title}</h3>
		</div>
		<p class="description">{description}</p>
		<div class="meta">
			<span class="source">{source}</span>
			{#if tags.length > 0}
				<div class="tags">
					{#each tags.slice(0, 3) as tag}
						<span class="tag">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	.article-card {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		overflow: hidden;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
		display: flex;
		flex-direction: column;
	}

	.article-card:hover,
	.article-card:focus-visible {
		background: var(--bg-warm);
	}

	.thumbnail {
		aspect-ratio: 16 / 9;
		overflow: hidden;
	}

	.thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.content {
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.header {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.cluster-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.title {
		font-family: var(--font-body);
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--text-primary);
		line-height: var(--leading-snug);
	}

	.description {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: var(--space-xs);
	}

	.source {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.tags {
		display: flex;
		gap: var(--space-xs);
	}

	.tag {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.tag::before {
		content: '#';
	}
</style>
