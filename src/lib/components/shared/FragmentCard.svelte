<script lang="ts">
	import type { Fragment } from '$lib/utils/types';
	import * as appStore from '$lib/stores/appStore.svelte';

	let {
		fragment,
		onpromote,
		onremove,
	}: {
		fragment: Fragment;
		onpromote: (fragment: Fragment) => void;
		onremove: (fragment: Fragment) => void;
	} = $props();

	let promoted = $state(false);

	function handlePromote() {
		promoted = true;
		onpromote(fragment);
	}

	function handleFindSimilar() {
		appStore.openSearch();
		appStore.performSearch(fragment.label);
	}
</script>

<div class="fragment-card">
	<span class="fragment-category">{fragment.category}</span>
	<h4 class="fragment-label">{fragment.label}</h4>
	<p class="fragment-content">{fragment.content}</p>

	{#if fragment.category === 'quote' && fragment.metadata?.excerpt}
		<blockquote class="fragment-excerpt">"{fragment.metadata.excerpt}"</blockquote>
	{/if}

	<div class="fragment-actions">
		{#if promoted}
			<span class="action-done">Saved</span>
		{:else}
			<button class="action-btn" onclick={handlePromote} title="Save as item">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Save
			</button>
		{/if}
		<button class="action-btn" onclick={handleFindSimilar} title="Find similar">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			Find
		</button>
		<button class="action-btn action-btn--subtle" onclick={() => onremove(fragment)} title="Remove">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
</div>

<style>
	.fragment-card {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.fragment-card:hover {
		border-color: var(--border-light);
	}

	.fragment-category {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.fragment-label {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.fragment-content {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.fragment-excerpt {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--text-xs);
		color: var(--text-secondary);
		margin: var(--space-xs) 0 0;
		padding-left: var(--space-sm);
		border-left: 2px solid var(--border-light);
	}

	.fragment-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-top: auto;
		padding-top: var(--space-xs);
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		font-family: var(--font-body);
		font-size: 11px;
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.action-btn:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
	}

	.action-btn--subtle {
		margin-left: auto;
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.fragment-card:hover .action-btn--subtle {
		opacity: 1;
	}

	.action-btn--subtle:hover {
		color: var(--cluster-vermillion);
	}

	.action-done {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		font-size: 11px;
		color: var(--accent-sage);
	}

	@media (max-width: 640px) {
		.action-btn--subtle {
			opacity: 1;
		}
	}
</style>
