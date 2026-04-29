<script lang="ts">
	import type { Fragment } from '$lib/utils/types';
	import FragmentCard from './FragmentCard.svelte';
	import PaletteFragment from './PaletteFragment.svelte';
	import * as appStore from '$lib/stores/appStore.svelte';

	let {
		itemId,
		dissectedAt,
		initialFragments = [],
	}: {
		itemId: string;
		dissectedAt: string | null;
		initialFragments?: Fragment[];
	} = $props();

	type DissectState = 'idle' | 'loading' | 'loaded' | 'error';

	let phase: DissectState = $state(dissectedAt && initialFragments.length > 0 ? 'loaded' : 'idle');
	let fragments: Fragment[] = $state(initialFragments);
	let errorMessage = $state('');
	let expanded = $state(true);

	// Sort by category so same-category cards sit adjacent in the grid,
	// then by sort_order within each category (AI assigns 0 = most prominent).
	let sortedFragments = $derived.by(() => {
		const seen = new Map<string, number>();
		for (const f of fragments) {
			if (!seen.has(f.category)) seen.set(f.category, seen.size);
		}
		return [...fragments].sort((a, b) => {
			const ca = seen.get(a.category) ?? 0;
			const cb = seen.get(b.category) ?? 0;
			if (ca !== cb) return ca - cb;
			return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
		});
	});

	async function handleDissect(force = false) {
		phase = 'loading';
		errorMessage = '';

		try {
			const url = `/api/items/${itemId}/dissect${force ? '?force=true' : ''}`;
			const res = await fetch(url, { method: 'POST' });

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Unknown error' }));
				throw new Error(err.message || `Error ${res.status}`);
			}

			const data = await res.json();
			fragments = data.fragments;
			phase = 'loaded';
		} catch (e) {
			errorMessage = (e as Error).message;
			phase = 'error';
		}
	}

	async function handlePromote(fragment: Fragment) {
		try {
			const res = await fetch(`/api/items/${itemId}/fragments/${fragment.id}/promote`, {
				method: 'POST',
			});
			if (res.ok) {
				appStore.showToast(`"${fragment.label}" saved to library`, 'success');
			} else {
				appStore.showToast('Failed to save fragment', 'error');
			}
		} catch {
			appStore.showToast('Failed to save fragment', 'error');
		}
	}

	async function handleRemove(fragment: Fragment) {
		try {
			const res = await fetch(`/api/items/${itemId}/fragments/${fragment.id}`, {
				method: 'DELETE',
			});
			if (res.ok) {
				fragments = fragments.filter((f) => f.id !== fragment.id);
				if (fragments.length === 0) phase = 'idle';
			}
		} catch {
			appStore.showToast('Failed to remove fragment', 'error');
		}
	}
</script>

<section class="dissect-section">
	{#if phase === 'idle'}
		<button class="dissect-trigger" onclick={() => handleDissect()}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="16" />
				<line x1="8" y1="12" x2="16" y2="12" />
			</svg>
			Dissect
		</button>

	{:else if phase === 'loading'}
		<div class="dissect-loading">
			<div class="shimmer-grid">
				{#each Array(6) as _}
					<div class="shimmer-card"></div>
				{/each}
			</div>
			<span class="loading-label">Analyzing...</span>
		</div>

	{:else if phase === 'loaded'}
		<div class="dissect-header">
			<button class="fragments-toggle" onclick={() => expanded = !expanded}>
				Fragments ({fragments.length})
				<svg
					width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
					class="toggle-chevron"
					class:toggle-chevron--collapsed={!expanded}
				>
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>
			<button class="re-dissect-btn" onclick={() => handleDissect(true)} title="Re-dissect">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="23 4 23 10 17 10" />
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
				</svg>
			</button>
		</div>

		{#if expanded}
			<div class="fragments-grid">
				{#each sortedFragments as fragment (fragment.id)}
					{#if fragment.category === 'palette'}
						<PaletteFragment {fragment} onpromote={handlePromote} onremove={handleRemove} />
					{:else}
						<FragmentCard {fragment} onpromote={handlePromote} onremove={handleRemove} />
					{/if}
				{/each}
			</div>
		{/if}

	{:else if phase === 'error'}
		<div class="dissect-error">
			<p class="error-text">Couldn't dissect this item. {errorMessage}</p>
			<button class="retry-btn" onclick={() => handleDissect()}>Retry</button>
		</div>
	{/if}
</section>

<style>
	.dissect-section {
		margin-top: var(--space-xl);
		padding-top: var(--space-xl);
		border-top: 1px solid var(--border-subtle);
	}

	/* -- Idle trigger -- */
	.dissect-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: 8px 16px;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.dissect-trigger:hover {
		color: var(--text-primary);
		border-color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
	}

	/* -- Loading -- */
	.dissect-loading {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.shimmer-grid,
	.fragments-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-sm);
		align-items: stretch;
	}

	.shimmer-card {
		height: 120px;
		border-radius: var(--radius-md);
		background: linear-gradient(
			90deg,
			var(--bg-surface-2) 25%,
			rgba(255, 255, 255, 0.04) 50%,
			var(--bg-surface-2) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	.loading-label {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-align: center;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* -- Loaded header -- */
	.dissect-header {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-lg);
	}

	.fragments-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.fragments-toggle:hover {
		color: var(--text-primary);
	}

	.toggle-chevron {
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.toggle-chevron--collapsed {
		transform: rotate(-90deg);
	}

	.re-dissect-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.re-dissect-btn:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.06);
	}

	/* -- Error -- */
	.dissect-error {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.error-text {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		margin: 0;
	}

	.retry-btn {
		padding: 6px 14px;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
	}

	.retry-btn:hover {
		color: var(--text-primary);
		border-color: var(--text-tertiary);
	}

	@media (max-width: 640px) {
		.shimmer-grid,
		.fragments-grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		}
	}
</style>
