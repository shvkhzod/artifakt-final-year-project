<script lang="ts">
	interface Props {
		message: string;
		type?: 'success' | 'error' | 'info';
		visible?: boolean;
		onclose?: () => void;
	}

	let { message, type = 'info', visible = false, onclose }: Props = $props();

	function dismiss() {
		onclose?.();
	}

	$effect(() => {
		if (visible) {
			const timer = setTimeout(dismiss, 3000);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if visible}
	<div class="toast toast--{type}" role="alert" aria-live="polite">
		<span class="toast-message">{message}</span>
		<button class="toast-close" onclick={dismiss} aria-label="Dismiss notification">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		bottom: var(--space-xl);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-lg);
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--text-primary);
		z-index: var(--z-toast);
		animation: slideUp var(--duration-normal) var(--ease-out);
		border-left: 3px solid var(--text-tertiary);
	}

	.toast--success {
		border-left-color: var(--cluster-emerald);
	}

	.toast--error {
		border-left-color: var(--cluster-vermillion);
	}

	.toast--info {
		border-left-color: var(--cluster-cyan);
	}

	.toast-message {
		white-space: nowrap;
	}

	.toast-close {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.toast-close:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}
</style>
