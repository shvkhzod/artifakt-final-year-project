<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let { variant = 'primary', size = 'md', disabled = false, onclick, children }: Props = $props();
</script>

<button
	class="btn btn--{variant} btn--{size}"
	{disabled}
	aria-disabled={disabled || undefined}
	{onclick}
>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-body);
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out),
			opacity var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn:focus-visible {
		outline: 2px solid var(--accent-sage);
		outline-offset: 2px;
	}

	/* Variants */
	.btn--primary {
		background: var(--accent-sage);
		color: var(--text-on-accent);
	}
	.btn--primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn--secondary {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid var(--border-light);
	}
	.btn--secondary:hover:not(:disabled) {
		background: var(--bg-warm);
		color: var(--text-primary);
	}

	.btn--ghost {
		background: transparent;
		color: var(--text-secondary);
		border: none;
	}
	.btn--ghost:hover:not(:disabled) {
		background: var(--bg-warm);
		color: var(--text-primary);
	}

	/* Sizes */
	.btn--sm {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--text-sm);
	}
	.btn--md {
		padding: var(--space-xs) var(--space-md);
		font-size: var(--text-base);
	}
	.btn--lg {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--text-lg);
	}
</style>
