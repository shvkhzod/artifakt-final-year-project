<script lang="ts">
	import StreamGraph from '$lib/components/timeline/StreamGraph.svelte';
	import ActivityHeatmap from '$lib/components/timeline/ActivityHeatmap.svelte';
	import { CLUSTER_COLORS } from '$lib/utils/colors';

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

	/* ── Stream definitions ──────────────────────── */

	const streams: StreamDef[] = [
		{ id: 'visual', name: 'Visual Aesthetics', color: CLUSTER_COLORS.amber },
		{ id: 'design', name: 'Design Philosophy', color: CLUSTER_COLORS.cyan },
		{ id: 'tech', name: 'Technology', color: CLUSTER_COLORS.emerald },
		{ id: 'literature', name: 'Literature', color: CLUSTER_COLORS.mauve },
		{ id: 'architecture', name: 'Architecture', color: CLUSTER_COLORS.blue },
		{ id: 'music', name: 'Music & Sound', color: CLUSTER_COLORS.vermillion },
	];

	/* ── Demo data generation ────────────────────── */

	function generateStreamData(): TimeSeriesData[] {
		const points: TimeSeriesData[] = [];
		const startDate = new Date('2025-03-17');

		for (let w = 0; w < 52; w++) {
			const date = new Date(startDate);
			date.setDate(date.getDate() + w * 7);

			const t = w / 52;

			// Visual Aesthetics: high activity, gradually growing
			const visual =
				5 + 3 * Math.sin(t * Math.PI * 4) +
				t * 6 +
				Math.sin(t * Math.PI * 7.3) * 2 +
				(Math.random() - 0.3) * 2;

			// Design Philosophy: moderate, steady
			const design =
				3.5 + 2 * Math.sin(t * Math.PI * 3.2 + 1) +
				Math.sin(t * Math.PI * 5.7) * 1.5 +
				(Math.random() - 0.4) * 1.5;

			// Technology: started low, big spike mid-timeline
			const techSpike = Math.exp(-Math.pow((t - 0.46) * 5, 2)) * 10;
			const tech =
				1 + t * 3 + techSpike +
				Math.sin(t * Math.PI * 6.1) * 1.5 +
				(Math.random() - 0.3) * 1.2;

			// Literature: low but constant
			const literature =
				1.5 + Math.sin(t * Math.PI * 2.8 + 2) * 1.2 +
				Math.sin(t * Math.PI * 8.3) * 0.6 +
				(Math.random() - 0.4) * 0.8;

			// Architecture: periodic bursts
			const archBurst1 = Math.exp(-Math.pow((t - 0.3) * 8, 2)) * 7;
			const archBurst2 = Math.exp(-Math.pow((t - 0.62) * 8, 2)) * 9;
			const archBurst3 = Math.exp(-Math.pow((t - 0.88) * 8, 2)) * 5;
			const architecture =
				0.8 + archBurst1 + archBurst2 + archBurst3 +
				Math.sin(t * Math.PI * 4.5) * 0.8 +
				(Math.random() - 0.4) * 1;

			// Music & Sound: emerged recently, growing
			const musicOnset = Math.max(0, (t - 0.55) * 3);
			const music =
				musicOnset * (3 + Math.sin(t * Math.PI * 5.2) * 2) +
				(t > 0.55 ? (Math.random() - 0.3) * 1.5 : 0);

			points.push({
				date,
				visual: Math.max(0.2, visual),
				design: Math.max(0.2, design),
				tech: Math.max(0.2, tech),
				literature: Math.max(0.2, literature),
				architecture: Math.max(0.2, architecture),
				music: Math.max(0, music),
			});
		}

		return points;
	}

	const allData = generateStreamData();

	/* ── Moment markers ──────────────────────────── */

	const moments: MomentMarker[] = [
		{ date: allData[0].date as Date, label: 'First save', streamId: 'visual' },
		{ date: allData[11].date as Date, label: 'Design deep-dive', streamId: 'design' },
		{ date: allData[23].date as Date, label: 'AI obsession begins', streamId: 'tech' },
		{ date: allData[31].date as Date, label: 'Brutalism phase', streamId: 'architecture' },
		{ date: allData[43].date as Date, label: '100th save', streamId: 'visual' },
	];

	/* ── Time range filter ───────────────────────── */

	type TimeRange = '3M' | '6M' | '1Y' | 'ALL';
	let activeRange: TimeRange = $state('1Y');

	let filteredData = $derived(() => {
		const weekCounts: Record<TimeRange, number> = {
			'3M': 13,
			'6M': 26,
			'1Y': 52,
			ALL: allData.length,
		};
		const count = weekCounts[activeRange];
		return allData.slice(allData.length - count);
	});

	let filteredMoments = $derived(() => {
		const d = filteredData();
		if (d.length === 0) return [];
		const startDate = d[0].date as Date;
		return moments.filter((m) => m.date >= startDate);
	});

	/* ── Stream hover state ──────────────────────── */

	let hoveredStream: string | null = $state(null);

	/* ── Activity heatmap data ───────────────────── */

	function generateHeatmapData(): { date: Date; count: number }[] {
		const days: { date: Date; count: number }[] = [];
		const startDate = new Date('2025-03-17');

		for (let d = 0; d < 365; d++) {
			const date = new Date(startDate);
			date.setDate(date.getDate() + d);

			const dayOfWeek = date.getDay();
			const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;
			const t = d / 365;

			// Base activity: weekdays higher
			let base = isWeekday ? 1.5 : 0.5;

			// Activity clusters
			const cluster1 = Math.exp(-Math.pow((t - 0.15) * 10, 2)) * 4;
			const cluster2 = Math.exp(-Math.pow((t - 0.45) * 8, 2)) * 6;
			const cluster3 = Math.exp(-Math.pow((t - 0.7) * 7, 2)) * 5;
			const cluster4 = Math.exp(-Math.pow((t - 0.9) * 9, 2)) * 4;

			// Growing trend
			const trend = t * 1.5;

			let count = base + cluster1 + cluster2 + cluster3 + cluster4 + trend + (Math.random() - 0.3) * 2;
			count = Math.max(0, Math.round(count));
			count = Math.min(8, count);

			days.push({ date, count });
		}

		return days;
	}

	const heatmapData = generateHeatmapData();

	/* ── Stats ────────────────────────────────────── */

	let totalItems = $derived(heatmapData.reduce((sum, d) => sum + d.count, 0));
	let activeDays = $derived(heatmapData.filter((d) => d.count > 0).length);
	let longestStreak = $derived(() => {
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

	/* ── Insight cards ───────────────────────────── */

	const insights = [
		{
			type: 'new_interest',
			title: 'New Interest Detected',
			description: 'Music & Sound appeared 5 months ago and is growing steadily. You\'ve saved 23 items in this area, mostly experimental ambient and generative compositions.',
			color: CLUSTER_COLORS.emerald,
		},
		{
			type: 'taste_shift',
			title: 'Taste Shift',
			description: 'Your Design Philosophy saves have evolved from minimalism toward more expressive, brutalist aesthetics. The shift began around August.',
			color: CLUSTER_COLORS.cyan,
		},
		{
			type: 'milestone',
			title: 'Milestone',
			description: 'You\'ve reached 100 saves in Visual Aesthetics, your most active interest. Photography and spatial composition dominate this cluster.',
			color: CLUSTER_COLORS.amber,
		},
	];
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
					onclick={() => (activeRange = range)}
				>
					{range}
				</button>
			{/each}
		</div>
	</header>

	<!-- ── Main content ────────────────────────── -->
	<main class="timeline-content">
		<!-- Stream Graph section -->
		<section class="section stream-section" aria-label="Interest evolution">
			<StreamGraph
				data={filteredData()}
				{streams}
				moments={filteredMoments()}
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
				{#each insights as insight (insight.type)}
					<article class="insight-card" style="--accent: {insight.color}">
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
				<span>{totalItems} items saved</span>
				<span class="stat-sep">&middot;</span>
				<span>{activeDays} active days</span>
				<span class="stat-sep">&middot;</span>
				<span>{longestStreak()} day longest streak</span>
			</div>
		</section>

		<!-- Quiet closer -->
		<footer class="closer">
			<p class="closer-text">Your mind never stops evolving.</p>
		</footer>
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
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: 400;
		color: var(--text-primary);
		letter-spacing: -0.02em;
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

	/* ── Sections ─────────────────────────────────────── */
	.section {
		margin-bottom: var(--space-3xl);
	}

	.section-title {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: 400;
		color: var(--text-primary);
		letter-spacing: -0.02em;
		margin-bottom: var(--space-lg);
	}

	/* ── Stream Section ───────────────────────────────── */
	.stream-section {
		margin-bottom: var(--space-3xl);
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
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	/* ── Insight Cards ─────────────────────────────────── */
	.insights-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-md);
	}

	.insight-card {
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.insight-card:hover {
		border-color: var(--border-light);
		border-left-color: var(--accent);
	}

	.insight-title {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: var(--space-xs);
	}

	.insight-description {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.55;
		margin: 0;
	}

	/* ── Activity Section ──────────────────────────────── */
	.activity-stats {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-top: var(--space-md);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}

	.stat-sep {
		color: var(--text-ghost);
	}

	/* ── Closer ──────────────────────────────────────── */
	.closer {
		text-align: center;
		padding: var(--space-3xl) 0;
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
