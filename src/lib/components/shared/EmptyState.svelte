<script lang="ts">
	let {
		heading,
		subtitle = '',
		cta,
	}: {
		heading: string;
		subtitle?: string;
		cta?: { label: string; href: string };
	} = $props();
</script>

<div class="empty-state">
	<h2 class="empty-heading">{heading}</h2>
	{#if subtitle}
		<p class="empty-subtitle">{subtitle}</p>
	{/if}
	{#if cta}
		<a href={cta.href} class="empty-cta">{cta.label}</a>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 40vh;
		text-align: center;
		padding: var(--space-3xl, 4rem) var(--space-lg, 1.5rem);
	}

	.empty-heading {
		font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
		font-size: var(--text-2xl, 1.9375rem);
		font-weight: 400;
		color: var(--text-secondary, rgba(255, 255, 255, 0.55));
		margin: 0 0 var(--space-xs, 0.5rem);
	}

	.empty-subtitle {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		color: var(--text-tertiary, rgba(255, 255, 255, 0.30));
		margin: 0;
		max-width: 32ch;
	}

	.empty-cta {
		display: inline-block;
		margin-top: var(--space-lg, 1.5rem);
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		font-weight: 500;
		color: var(--accent-sage, #7B9E87);
		text-decoration: none;
		padding: 8px 20px;
		border: 1px solid var(--accent-sage, #7B9E87);
		border-radius: var(--radius-full, 9999px);
		transition: background var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.empty-cta:hover {
		background: rgba(123, 158, 135, 0.1);
	}
</style>
