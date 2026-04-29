<script lang="ts">
	import { onMount } from 'svelte';
	import StreamGraph from '$lib/components/timeline/StreamGraph.svelte';
	import ActivityHeatmap from '$lib/components/timeline/ActivityHeatmap.svelte';
	import * as appStore from '$lib/stores/appStore.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	let { data }: { data?: any } = $props();

	/* ── Types ────────────────────────────────────── */

	interface TimeSeriesData {
		date: Date;
		[streamId: string]: number | Date;
	}

	interface StreamDef {
		id: string;
		name: string;
		color: string;
	}

	interface MomentMarker {
		date: Date;
		label: string;
		streamId: string;
	}

	/* ── Wire to server loader data ─────────────── */

	const streams: StreamDef[] = $derived(data?.streams ?? []);
	const allData: TimeSeriesData[] = $derived(
		(data?.weeks ?? []).map((w: any) => ({ ...w, date: new Date(w.date) }))
	);
	const moments: MomentMarker[] = $derived(
		(data?.moments ?? []).map((m: any) => ({ ...m, date: new Date(m.date) }))
	);
	const heatmapData = $derived(
		(data?.heatmapData ?? []).map((d: any) => ({ date: new Date(d.date), count: d.count }))
	);
	const insights: any[] = $derived(data?.insights ?? []);

	/* ── Time range filter ───────────────────────── */

	type TimeRange = '3M' | '6M' | '1Y' | 'ALL';
	let activeRange: TimeRange = $state('1Y');

	let filteredData = $derived.by(() => {
		const weekCounts: Record<TimeRange, number> = {
			'3M': 13,
			'6M': 26,
			'1Y': 52,
			ALL: allData.length,
		};
		const count = weekCounts[activeRange];
		return allData.slice(allData.length - count);
	});

	let filteredMoments = $derived.by(() => {
		if (filteredData.length === 0) return [];
		const startDate = filteredData[0].date as Date;
		return moments.filter((m) => m.date >= startDate);
	});

	/* ── Stream hover state ──────────────────────── */

	let hoveredStream: string | null = $state(null);

	/* ── Search context ──────────────────────────── */

	function updateSearchContext() {
		const now = new Date();
		const rangeMonths: Record<TimeRange, number | null> = {
			'3M': 3, '6M': 6, '1Y': 12, 'ALL': null,
		};
		const months = rangeMonths[activeRange];
		if (months) {
			const after = new Date(now);
			after.setMonth(after.getMonth() - months);
			appStore.setSearchContext({
				page: 'timeline',
				after: after.toISOString(),
				before: now.toISOString(),
			});
		} else {
			appStore.setSearchContext({ page: 'timeline' });
		}
	}

	onMount(() => {
		updateSearchContext();
	});

	/* ── Stats ────────────────────────────────────── */

	let totalItems = $derived(data?.totalItems ?? 0);
	let activeDays = $derived(heatmapData.filter((d: any) => d.count > 0).length);
	let longestStreak = $derived.by(() => {
		let max = 0;
		let current = 0;
		for (const d of heatmapData) {
			if (d.count > 0) {
				current++;
				if (current > max) max = current;
			} else {
				current = 0;
			}
		}
		return max;
	});
</script>

<svelte:head>
	<title>Timeline — Aina</title>
</svelte:head>

<div class="timeline-page">
	<!-- ── Sub-header with range tabs ─────────── -->
	<header class="sub-header">
		<h1 class="page-title">Timeline</h1>
		<div class="range-tabs" role="tablist" aria-label="Time range">
			{#each (['3M', '6M', '1Y', 'ALL'] as TimeRange[]) as range (range)}
				<button
					class="range-tab"
					class:active={activeRange === range}
					role="tab"
					aria-selected={activeRange === range}
					onclick={() => { activeRange = range; updateSearchContext(); }}
				>
					{range}
				</button>
			{/each}
		</div>
	</header>

	<!-- ── Main content ────────────────────────── -->
	<main class="timeline-content">
		{#if streams.length === 0}<EmptyState heading="No history yet" subtitle="Your timeline builds as you save items over time" />{:else}
		<!-- Stream Graph section -->
		<section class="section stream-section" aria-label="Interest evolution">
			<StreamGraph
				data={filteredData}
				{streams}
				moments={filteredMoments}
				bind:hoveredStream
			/>

			<!-- Legend -->
			<div class="legend" role="list" aria-label="Stream legend">
				{#each streams as stream (stream.id)}
					<div
						class="legend-item"
						class:legend-dimmed={hoveredStream !== null && hoveredStream !== stream.id}
						role="listitem"
					>
						<span class="legend-dot" style="background: {stream.color}"></span>
						<span class="legend-name">{stream.name}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Insights section -->
		<section class="section insights-section" aria-label="Insights">
			<h2 class="section-title">Insights</h2>
			<div class="insights-grid">
				{#each insights as insight, idx (insight.title)}
					<article
						class="insight-card"
						class:insight-featured={idx === 0}
						style="--accent: {insight.color}"
					>
						<span class="insight-dot" style="background: {insight.color}"></span>
						<h3 class="insight-title">{insight.title}</h3>
						<p class="insight-description">{insight.description}</p>
					</article>
				{/each}
			</div>
		</section>

		<!-- Activity heatmap section -->
		<section class="section activity-section" aria-label="Activity">
			<h2 class="section-title">Activity</h2>
			<ActivityHeatmap data={heatmapData} />
			<div class="activity-stats">
				<div class="stat">
					<span class="stat-value">{totalItems}</span>
					<span class="stat-label">items saved</span>
				</div>
				<span class="stat-sep"></span>
				<div class="stat">
					<span class="stat-value">{activeDays}</span>
					<span class="stat-label">active days</span>
				</div>
				<span class="stat-sep"></span>
				<div class="stat">
					<span class="stat-value">{longestStreak}</span>
					<span class="stat-label">day streak</span>
				</div>
			</div>
		</section>

		<!-- Quiet closer -->
		<footer class="closer">
			<p class="closer-text">Your mind never stops evolving.</p>
		</footer>
		{/if}
	</main>
</div>

<style>
	/* ── Page ───────────────────────────────────────── */
	.timeline-page {
		min-height: 100vh;
		background: var(--bg-void);
		color: var(--text-primary);
	}

	/* ── Sub Header ─────────────────────────────────── */
	.sub-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg) var(--space-sm);
		max-width: 960px;
		margin: 0 auto;
	}

	.page-title {
		font-size: var(--text-2xl);
		color: var(--text-primary);
		user-select: none;
	}

	/* ── Range Tabs ──────────────────────────────────── */
	.range-tabs {
		display: flex;
		gap: 2px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-full);
		padding: 2px;
	}

	.range-tab {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-tertiary);
		background: none;
		border: none;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
		min-width: 44px;
		min-height: 32px;
	}

	.range-tab:hover {
		color: var(--text-secondary);
	}

	.range-tab.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	/* ── Main Content ────────────────────────────────── */
	.timeline-content {
		max-width: 960px;
		margin: 0 auto;
		padding: var(--space-xl) var(--space-lg);
	}

	/* ── Sections — varied rhythm ────────────────────── */
	.section {
		margin-bottom: var(--space-3xl);
	}

	.section-title {
		color: var(--text-primary);
		margin-bottom: var(--space-lg);
	}

	/* Stream section: hero content — most visual weight, generous bottom space */
	.stream-section {
		margin-bottom: 5rem;
	}

	/* Insights: moderate separation */
	.insights-section {
		margin-bottom: var(--space-3xl);
	}

	/* Activity: tighter — data-dense, leads into the closer */
	.activity-section {
		margin-bottom: var(--space-xl);
	}

	/* ── Legend ─────────────────────────────────────────── */
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md) var(--space-lg);
		margin-top: var(--space-md);
		padding: 0 var(--space-xs);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		transition: opacity var(--duration-normal) var(--ease-out);
	}

	.legend-dimmed {
		opacity: 0.3;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.legend-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	/* ── Insight Cards ─────────────────────────────────── */
	.insights-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	.insight-card {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		transition: border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	/* First insight spans full width — featured item breaks the grid */
	.insight-featured {
		grid-column: 1 / -1;
		padding: var(--space-xl) var(--space-lg);
	}

	.insight-featured .insight-title {
		font-size: var(--text-base);
	}

	.insight-card:hover {
		border-color: var(--border-light);
		background: var(--bg-surface-1);
	}

	.insight-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		margin-bottom: var(--space-sm);
	}

	.insight-title {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: var(--space-xs);
	}

	.insight-description {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-normal);
		margin: 0;
	}

	/* ── Activity Stats ──────────────────────────────── */
	.activity-stats {
		display: flex;
		align-items: baseline;
		gap: var(--space-lg);
		margin-top: var(--space-lg);
	}

	.stat {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
	}

	.stat-value {
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text-primary);
		letter-spacing: var(--tracking-tight);
	}

	.stat-label {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}

	.stat-sep {
		width: 1px;
		height: 16px;
		background: var(--border-subtle);
		align-self: center;
	}

	/* ── Closer ──────────────────────────────────────── */
	.closer {
		text-align: center;
		padding: 5rem 0 var(--space-3xl);
		border-top: 1px solid var(--border-subtle);
		margin-top: var(--space-2xl);
	}

	.closer-text {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-style: italic;
		color: var(--text-tertiary);
		margin: 0;
	}

	/* ── Responsive ───────────────────────────────────── */
	@media (max-width: 768px) {
		.timeline-content {
			padding: var(--space-lg) var(--space-md);
		}

		.insights-grid {
			grid-template-columns: 1fr;
			gap: var(--space-sm);
		}

		.insight-featured {
			padding: var(--space-lg);
		}

		.activity-stats {
			gap: var(--space-md);
		}

		.sub-header {
			padding: var(--space-sm) var(--space-md);
		}

		.range-tab {
			padding: 6px 10px;
			font-size: var(--text-2xs);
		}

		.legend {
			gap: var(--space-sm) var(--space-md);
		}

		.activity-stats {
			flex-wrap: wrap;
			gap: var(--space-xs) var(--space-sm);
		}
	}

	@media (max-width: 480px) {
		.insights-grid {
			gap: var(--space-sm);
		}

		.insight-card {
			padding: var(--space-md);
		}
	}
</style>
