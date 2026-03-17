<script lang="ts">
	interface Props {
		name: string;
		color?: 'amber' | 'cyan' | 'emerald' | 'blue' | 'vermillion' | 'mauve';
		active?: boolean;
		toggleable?: boolean;
		onclick?: () => void;
	}

	let { name, color = 'amber', active = false, toggleable = false, onclick }: Props = $props();
</script>

{#if toggleable}
	<button
		class="pill"
		class:active
		style="--pill-color: var(--cluster-{color})"
		aria-pressed={active}
		{onclick}
	>
		{name}
	</button>
{:else}
	<span
		class="pill"
		class:active
		style="--pill-color: var(--cluster-{color})"
		role="status"
	>
		{name}
	</span>
{/if}

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 2px var(--space-sm);
		border-radius: var(--radius-full);
		border: none;
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--pill-color);
		background: color-mix(in srgb, var(--pill-color) 12%, transparent);
		transition: background var(--duration-fast) var(--ease-out);
		cursor: default;
	}

	button.pill {
		cursor: pointer;
	}

	.pill.active {
		background: color-mix(in srgb, var(--pill-color) 25%, transparent);
	}
</style>
