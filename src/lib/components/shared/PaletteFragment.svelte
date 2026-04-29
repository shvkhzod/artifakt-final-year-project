<script lang="ts">
	import type { Fragment } from '$lib/utils/types';

	let {
		fragment,
		onpromote,
		onremove,
	}: {
		fragment: Fragment;
		onpromote: (fragment: Fragment) => void;
		onremove: (fragment: Fragment) => void;
	} = $props();

	const colors = $derived(
		(fragment.metadata?.colors as string[]) ?? [],
	);

	let promoted = $state(false);
</script>

<div class="palette-card">
	<span class="palette-category">{fragment.category}</span>
	<h4 class="palette-label">{fragment.label}</h4>

	{#if colors.length > 0}
		<div class="swatch-row">
			{#each colors as color}
				<div class="swatch" style="background: {color}">
					<span class="swatch-hex">{color}</span>
				</div>
			{/each}
		</div>
	{/if}

	<p class="palette-content">{fragment.content}</p>

	<div class="palette-actions">
		{#if promoted}
			<span class="action-done">Saved</span>
		{:else}
			<button class="action-btn" onclick={() => { promoted = true; onpromote(fragment); }}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Save
			</button>
		{/if}
		<button class="action-btn action-btn--subtle" onclick={() => onremove(fragment)}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>
	</div>
</div>

<style>
	.palette-card {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.palette-card:hover {
		border-color: var(--border-light);
	}

	.palette-category {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.palette-label {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.swatch-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.swatch {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.swatch-hex {
		position: absolute;
		bottom: -18px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 9px;
		font-family: var(--font-body);
		color: var(--text-tertiary);
		white-space: nowrap;
	}

	.palette-content {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1.5;
		margin: var(--space-sm) 0 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.palette-actions {
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

	.palette-card:hover .action-btn--subtle {
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
</style>
