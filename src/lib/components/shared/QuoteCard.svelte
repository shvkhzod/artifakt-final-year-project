<script lang="ts">
	interface Props {
		content: string;
		author: string;
		source?: string;
		clusterColor?: 'amber' | 'cyan' | 'emerald' | 'blue' | 'vermillion' | 'mauve';
	}

	let { content, author, source, clusterColor }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.currentTarget as HTMLElement).click();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article class="quote-card" tabindex="0" role="button" onkeydown={handleKeydown} style={clusterColor ? `--accent: var(--cluster-${clusterColor})` : '--accent: var(--border-light)'}>
	<span class="quote-mark">&ldquo;</span>
	<blockquote class="quote-text">{content}</blockquote>
	<footer class="attribution">
		<span class="author">{author}</span>
		{#if source}
			<span class="source">{source}</span>
		{/if}
	</footer>
</article>

<style>
	.quote-card {
		background: var(--bg-surface-2);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		border-left: 3px solid var(--accent);
		position: relative;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.quote-card:hover,
	.quote-card:focus-visible {
		background: var(--bg-warm);
	}

	.quote-mark {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		color: var(--text-ghost);
		line-height: 1;
		position: absolute;
		top: var(--space-sm);
		left: var(--space-md);
	}

	.quote-text {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--text-lg);
		color: var(--text-primary);
		line-height: var(--leading-normal);
		margin-top: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.attribution {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.author {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: 500;
	}

	.source {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
</style>
