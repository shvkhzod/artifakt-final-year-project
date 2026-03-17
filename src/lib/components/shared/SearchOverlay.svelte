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

	// Focus input when overlay opens
	$effect(() => {
		if (appStore.getSearchOpen() && inputEl) {
			// Small delay for animation
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	let activeResultIndex: number = $state(-1);

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
		const results = appStore.getSearchResults();
		if (results.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeResultIndex = Math.min(activeResultIndex + 1, results.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeResultIndex = Math.max(activeResultIndex - 1, -1);
			if (activeResultIndex === -1) inputEl?.focus();
		} else if (event.key === 'Enter' && activeResultIndex >= 0) {
			event.preventDefault();
			handleResultClick(results[activeResultIndex].id);
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

			<!-- Results -->
			<div class="search-results">
				{#if appStore.getIsSearching()}
					<div class="search-status">
						<span class="search-status-text">Searching...</span>
					</div>
				{:else if appStore.getSearchQuery().trim() && appStore.getSearchResults().length === 0}
					<div class="search-status">
						<span class="search-status-text">No results found</span>
					</div>
				{:else if appStore.getSearchResults().length > 0}
					<ul class="results-list" role="listbox" aria-label="Search results">
						{#each appStore.getSearchResults() as result, idx (result.id)}
							<li class="result-item" role="option" aria-selected={idx === activeResultIndex}>
								<button class="result-btn" class:result-active={idx === activeResultIndex} onclick={() => handleResultClick(result.id)}>
									<div class="result-type-icon">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
											<path d={typeIcons[result.type] || typeIcons.article} />
										</svg>
									</div>
									<div class="result-info">
										<span class="result-title">{result.title || 'Untitled'}</span>
										{#if result.content}
											<span class="result-snippet">{truncate(result.content, 80)}</span>
										{/if}
										{#if result.url}
											<span class="result-source">{extractDomain(result.url)}</span>
										{/if}
									</div>
									<svg class="result-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
										<path d="m9 18 6-6-6-6" />
									</svg>
								</button>
							</li>
						{/each}
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
