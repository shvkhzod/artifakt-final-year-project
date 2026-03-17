<script lang="ts">
	interface Props {
		value?: string;
		placeholder?: string;
		onsearch?: (query: string) => void;
	}

	let { value = $bindable(''), placeholder = 'Search your collection...', onsearch }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onsearch) {
			onsearch(value);
		}
	}

	function handleClear() {
		value = '';
		if (onsearch) onsearch('');
	}
</script>

<div class="search-bar" role="search">
	<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.3-4.3" />
	</svg>
	<input
		type="text"
		bind:value
		{placeholder}
		onkeydown={handleKeydown}
		class="search-input"
		aria-label="Search your collection"
	/>
	{#if value}
		<button class="clear-btn" onclick={handleClear} aria-label="Clear search">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.search-icon {
		position: absolute;
		left: var(--space-md);
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: var(--space-sm) calc(var(--space-sm) + 32px) var(--space-sm) calc(var(--space-md) + 26px);
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-full);
		color: var(--text-primary);
		font-size: var(--text-base);
		outline: none;
		transition: border-color var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-out);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.search-input:focus {
		border-color: var(--border-light);
		box-shadow: 0 0 0 3px rgba(123, 158, 135, 0.1);
	}

	.clear-btn {
		position: absolute;
		right: var(--space-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.clear-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary);
	}
</style>
