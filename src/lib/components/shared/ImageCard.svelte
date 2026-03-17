<script lang="ts">
	interface Props {
		src: string;
		title: string;
		clusterColor?: 'amber' | 'cyan' | 'emerald' | 'blue' | 'vermillion' | 'mauve';
		tags?: string[];
	}

	let { src, title, clusterColor, tags = [] }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.currentTarget as HTMLElement).click();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article class="image-card" tabindex="0" role="button" onkeydown={handleKeydown}>
	<div class="image-wrapper">
		<img {src} alt={title || 'Saved image'} loading="lazy" />
	</div>
	<div class="overlay">
		{#if clusterColor}
			<span class="cluster-dot" style="background: var(--cluster-{clusterColor})"></span>
		{/if}
		<h3 class="title">{title}</h3>
		{#if tags.length > 0}
			<div class="tags">
				{#each tags.slice(0, 3) as tag}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		{/if}
	</div>
</article>

<style>
	.image-card {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
		cursor: pointer;
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.image-card:hover,
	.image-card:focus-visible {
		transform: scale(1.02);
	}

	.image-wrapper {
		aspect-ratio: 4 / 3;
		overflow: hidden;
	}

	.image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform var(--duration-normal) var(--ease-out);
	}

	.image-card:hover img {
		transform: scale(1.05);
	}

	.overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: var(--space-lg) var(--space-md) var(--space-md);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
		display: flex;
		flex-direction: column;
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
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		line-height: var(--leading-snug);
	}

	.tags {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.tag {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.tag::before {
		content: '#';
	}
</style>
