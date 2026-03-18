<script lang="ts">
	import { goto } from '$app/navigation';
	import * as appStore from '$lib/stores/appStore.svelte';
	import { createFocusTrap } from '$lib/utils/focusTrap';

	let inputEl: HTMLInputElement | undefined = $state();
	let overlayEl: HTMLDivElement | undefined = $state();

	const handleFocusTrap = createFocusTrap(() => overlayEl);

	/* Item type icons as SVG path data */
	const typeIcons: Record<string, string> = {
		image: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm15 10.59-3.54-3.54a1 1 0 0 0-1.41 0L9.17 17H19v-1.41zM5 17h1.76l6.37-6.37-2.3-2.3L5 14.17V17zM8.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		article: 'M4 4h16v16H4V4zm2 3v2h12V7H6zm0 4v2h12v-2H6zm0 4v2h8v-2H6z',
		quote: 'M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z',
		screenshot: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm2 0v14h14V5H5zm2 2h3v3H7V7zm7 0h3v3h-3V7z',
	};

	let searchContext = $derived(appStore.getSearchContext());

	// Focus input when overlay opens
	$effect(() => {
		if (appStore.getSearchOpen() && inputEl) {
			// Small delay for animation
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	let activeResultIndex: number = $state(-1);

	// Flatten results for keyboard navigation regardless of grouped/flat shape
	interface ResultGroup {
		cluster: { id: string; name: string; color: string } | null;
		items: any[];
	}

	let rawResults = $derived(appStore.getSearchResults());

	let isGrouped = $derived(
		Array.isArray(rawResults) &&
		rawResults.length > 0 &&
		'cluster' in rawResults[0] &&
		'items' in rawResults[0]
	);

	let groups = $derived(isGrouped ? (rawResults as unknown as ResultGroup[]) : []);

	let flatResults = $derived(
		isGrouped
			? (rawResults as unknown as ResultGroup[]).flatMap((g) => g.items)
			: (rawResults as any[])
	);

	// Reset active index when results change
	$effect(() => {
		appStore.getSearchResults();
		activeResultIndex = -1;
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && appStore.getSearchOpen()) {
			appStore.closeSearch();
			return;
		}

		// Focus trap
		handleFocusTrap(event);

		// Arrow key navigation through results
		if (flatResults.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeResultIndex = Math.min(activeResultIndex + 1, flatResults.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeResultIndex = Math.max(activeResultIndex - 1, -1);
			if (activeResultIndex === -1) inputEl?.focus();
		} else if (event.key === 'Enter' && activeResultIndex >= 0) {
			event.preventDefault();
			handleResultClick(flatResults[activeResultIndex].id);
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		appStore.performSearch(target.value);
	}

	function handleResultClick(itemId: string) {
		appStore.closeSearch();
		goto(`/item/${itemId}`);
	}

	function handleBackdropClick() {
		appStore.closeSearch();
	}

	function clearContext() {
		appStore.setSearchContext({ page: searchContext.page });
	}

	function extractDomain(url: string | null): string {
		if (!url) return '';
		try {
			return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
		} catch {
			return url;
		}
	}

	function truncate(text: string | null, maxLen: number): string {
		if (!text) return '';
		return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
	}

	function relativeDate(date: Date | string): string {
		const d = new Date(date);
		const now = new Date();
		const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
		if (days === 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 7) return `${days}d ago`;
		if (days < 30) return `${Math.floor(days / 7)}w ago`;
		if (days < 365) return `${Math.floor(days / 30)}mo ago`;
		return `${Math.floor(days / 365)}y ago`;
	}

	/**
	 * For grouped rendering, compute the flat index of an item
	 * given its group index and position within that group.
	 */
	function flatIndex(groupIdx: number, itemIdx: number): number {
		let offset = 0;
		for (let i = 0; i < groupIdx; i++) {
			offset += groups[i].items.length;
		}
		return offset + itemIdx;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appStore.getSearchOpen()}
	<!-- Backdrop -->
	<div class="search-backdrop" onclick={handleBackdropClick} role="presentation"></div>

	<!-- Overlay -->
	<div class="search-overlay" role="dialog" aria-label="Search" aria-modal="true" bind:this={overlayEl}>
		<div class="search-container">
			<!-- Search input -->
			<div class="search-input-wrap">
				<svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<input
					bind:this={inputEl}
					type="text"
					class="search-input"
					placeholder="Search your collection..."
					value={appStore.getSearchQuery()}
					oninput={handleInput}
					autocomplete="off"
					spellcheck="false"
				/>
				<button class="search-close-btn" onclick={appStore.closeSearch} aria-label="Close search">
					<span class="esc-badge">Esc</span>
				</button>
			</div>

			<!-- Context pill -->
			{#if searchContext.clusterId || searchContext.after}
				<div class="context-pill-wrap">
					<div class="context-pill">
						{#if searchContext.clusterId}
							<span class="context-dot" style="background: {searchContext.clusterColor}"></span>
							<span>{searchContext.clusterName}</span>
						{:else if searchContext.after}
							<span>Filtered by date</span>
						{/if}
						<button class="context-clear" onclick={clearContext}>&#215;</button>
					</div>
				</div>
			{/if}

			<!-- Results -->
			<div class="search-results">
				{#if appStore.getIsSearching()}
					<div class="search-status">
						<span class="search-status-text">Searching...</span>
					</div>
				{:else if appStore.getSearchQuery().trim() && flatResults.length === 0}
					<div class="search-status">
						<span class="search-status-text">No results found</span>
					</div>
				{:else if flatResults.length > 0}
					<ul class="results-list" role="listbox" aria-label="Search results">
						{#if isGrouped}
							{#each groups as group, gIdx}
								<li class="result-group" role="group">
									<div class="result-group-header">
										{#if group.cluster}
											<span class="context-dot" style="background: {group.cluster.color}"></span>
											<span>{group.cluster.name}</span>
											<span class="group-count">({group.items.length})</span>
										{:else}
											<span>Other</span>
											<span class="group-count">({group.items.length})</span>
										{/if}
									</div>
									<ul class="result-group-items">
										{#each group.items as result, iIdx (result.id)}
											{@const fIdx = flatIndex(gIdx, iIdx)}
											<li class="result-item" role="option" aria-selected={fIdx === activeResultIndex}>
												<button class="result-btn" class:result-active={fIdx === activeResultIndex} onclick={() => handleResultClick(result.id)}>
													{#if (result.type === 'image' || result.type === 'screenshot') && (result.thumbnailUrl || result.thumbnail_url || result.url)}
														<div class="result-thumb">
															<img src={result.thumbnailUrl || result.thumbnail_url || result.url} alt="" loading="lazy" />
														</div>
													{:else}
														<div class="result-type-icon">
															<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
																<path d={typeIcons[result.type] || typeIcons.article} />
															</svg>
														</div>
													{/if}
													<div class="result-info">
														<span class="result-title">{result.title || 'Untitled'}</span>
														{#if result.content}
															<span class="result-snippet">{truncate(result.content, 80)}</span>
														{/if}
														{#if result.url && result.type !== 'image' && result.type !== 'screenshot'}
															<span class="result-source">{extractDomain(result.url)}</span>
														{/if}
													</div>
													{#if result.createdAt || result.created_at}
														<span class="result-date">{relativeDate(result.createdAt || result.created_at)}</span>
													{/if}
													<svg class="result-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
														<path d="m9 18 6-6-6-6" />
													</svg>
												</button>
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						{:else}
							{#each flatResults as result, idx (result.id)}
								<li class="result-item" role="option" aria-selected={idx === activeResultIndex}>
									<button class="result-btn" class:result-active={idx === activeResultIndex} onclick={() => handleResultClick(result.id)}>
										{#if (result.type === 'image' || result.type === 'screenshot') && (result.thumbnailUrl || result.thumbnail_url || result.url)}
											<div class="result-thumb">
												<img src={result.thumbnailUrl || result.thumbnail_url || result.url} alt="" loading="lazy" />
											</div>
										{:else}
											<div class="result-type-icon">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
													<path d={typeIcons[result.type] || typeIcons.article} />
												</svg>
											</div>
										{/if}
										<div class="result-info">
											<span class="result-title">{result.title || 'Untitled'}</span>
											{#if result.content}
												<span class="result-snippet">{truncate(result.content, 80)}</span>
											{/if}
											{#if result.url && result.type !== 'image' && result.type !== 'screenshot'}
												<span class="result-source">{extractDomain(result.url)}</span>
											{/if}
										</div>
										{#if result.createdAt || result.created_at}
											<span class="result-date">{relativeDate(result.createdAt || result.created_at)}</span>
										{/if}
										<svg class="result-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
											<path d="m9 18 6-6-6-6" />
										</svg>
									</button>
								</li>
							{/each}
						{/if}
					</ul>
				{:else}
					<div class="search-empty">
						<p class="search-empty-text">Type to search your saved items</p>
						<p class="search-empty-hint">Search by title, content, or source</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── Backdrop ──────────────────────────────── */
	.search-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		background: rgba(0, 0, 0, 0.7);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	/* ── Overlay ──────────────────────────────── */
	.search-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-overlay);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 12vh;
		pointer-events: none;
	}

	.search-container {
		width: 100%;
		max-width: 560px;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-lg);
		box-shadow: 0 24px 80px -12px rgba(0, 0, 0, 0.6);
		overflow: hidden;
		pointer-events: auto;
		animation: scaleIn var(--duration-fast) var(--ease-out);
	}

	/* ── Search Input ─────────────────────────── */
	.search-input-wrap {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--border-subtle);
	}

	.search-icon {
		flex-shrink: 0;
		color: var(--text-tertiary);
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		font-family: var(--font-body);
		font-size: var(--text-lg);
		color: var(--text-primary);
		caret-color: var(--accent-sage);
	}

	.search-input::placeholder {
		color: var(--text-ghost);
	}

	.search-close-btn {
		flex-shrink: 0;
		border: none;
		background: none;
		cursor: pointer;
		padding: 0;
	}

	.esc-badge {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		font-weight: 500;
		color: var(--text-tertiary);
		border: 1px solid var(--border-light);
		border-radius: 4px;
		padding: 2px 6px;
	}

	/* ── Context Pill ─────────────────────────── */
	.context-pill-wrap {
		padding: var(--space-sm) var(--space-lg) 0;
	}

	.context-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px 3px 6px;
		margin: 0 0 var(--space-xs);
		font-size: 11px;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
	}

	.context-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.context-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border: none;
		background: none;
		color: var(--text-ghost);
		font-size: 12px;
		cursor: pointer;
		padding: 0;
		border-radius: 50%;
	}

	.context-clear:hover {
		color: var(--text-tertiary);
	}

	/* ── Results ──────────────────────────────── */
	.search-results {
		max-height: 400px;
		overflow-y: auto;
	}

	.search-status {
		padding: var(--space-xl) var(--space-lg);
		text-align: center;
	}

	.search-status-text {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}

	.search-empty {
		padding: var(--space-2xl) var(--space-lg);
		text-align: center;
	}

	.search-empty-text {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin-bottom: var(--space-xs);
	}

	.search-empty-hint {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	/* ── Result List ──────────────────────────── */
	.results-list {
		list-style: none;
		margin: 0;
		padding: var(--space-xs) 0;
	}

	.result-group {
		list-style: none;
	}

	.result-group-items {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.result-group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px 4px;
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-ghost);
	}

	.group-count {
		color: var(--text-ghost);
		font-weight: 400;
	}

	.result-item {
		margin: 0;
	}

	.result-btn {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-lg);
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.result-btn:hover,
	.result-btn.result-active {
		background: rgba(255, 255, 255, 0.04);
	}

	.result-type-icon {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-tertiary);
	}

	.result-thumb {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: rgba(255, 255, 255, 0.04);
	}

	.result-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.result-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.result-title {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-snippet {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.result-source {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		color: var(--text-tertiary);
	}

	.result-date {
		font-size: 10px;
		color: var(--text-ghost);
		flex-shrink: 0;
		margin-left: auto;
		padding-left: var(--space-xs);
	}

	.result-arrow {
		flex-shrink: 0;
		color: var(--text-ghost);
		transition: color var(--duration-fast) var(--ease-out);
	}

	.result-btn:hover .result-arrow {
		color: var(--text-tertiary);
	}

	/* ── Scrollbar ────────────────────────────── */
	.search-results::-webkit-scrollbar {
		width: 4px;
	}

	.search-results::-webkit-scrollbar-track {
		background: transparent;
	}

	.search-results::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
	}

	/* ── Responsive ───────────────────────────── */
	@media (max-width: 640px) {
		.search-overlay {
			padding-top: var(--space-md);
			padding-left: var(--space-sm);
			padding-right: var(--space-sm);
		}

		.search-input {
			font-size: var(--text-base);
		}
	}
</style>
