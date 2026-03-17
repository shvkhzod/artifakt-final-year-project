<script lang="ts">
	import * as d3 from 'd3';

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

	interface Props {
		data: TimeSeriesData[];
		streams: StreamDef[];
		moments?: MomentMarker[];
		hoveredStream?: string | null;
	}

	let {
		data,
		streams,
		moments = [],
		hoveredStream = $bindable(null),
	}: Props = $props();

	/* ── Responsive container ────────────────────── */

	let containerEl: HTMLDivElement | undefined = $state();
	let width = $state(900);
	const height = 320;
	const margin = { top: 20, right: 20, bottom: 36, left: 20 };

	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	/* ── Reduced motion ──────────────────────────── */

	let prefersReducedMotion = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = mq.matches;
		function onChange(e: MediaQueryListEvent) {
			prefersReducedMotion = e.matches;
		}
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	/* ── Scales ───────────────────────────────────── */

	let xScale = $derived(
		d3
			.scaleTime()
			.domain(d3.extent(data, (d) => d.date) as [Date, Date])
			.range([margin.left, width - margin.right])
	);

	let stackKeys = $derived(streams.map((s) => s.id));

	let stackedData = $derived(
		d3
			.stack<TimeSeriesData>()
			.keys(stackKeys)
			.value((d, key) => (d[key] as number) ?? 0)
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetWiggle)(data)
	);

	let yExtent = $derived(() => {
		let min = Infinity;
		let max = -Infinity;
		for (const layer of stackedData) {
			for (const point of layer) {
				if (point[0] < min) min = point[0];
				if (point[1] > max) max = point[1];
			}
		}
		return [min, max] as [number, number];
	});

	let yScale = $derived(
		d3
			.scaleLinear()
			.domain(yExtent())
			.range([height - margin.bottom, margin.top])
	);

	/* ── Area + line generators ───────────────────── */

	let areaGenerator = $derived(
		d3
			.area<d3.SeriesPoint<TimeSeriesData>>()
			.x((d) => xScale(d.data.date))
			.y0((d) => yScale(d[0]))
			.y1((d) => yScale(d[1]))
			.curve(d3.curveCardinal.tension(0.3))
	);

	let upperEdgeGenerator = $derived(
		d3
			.line<d3.SeriesPoint<TimeSeriesData>>()
			.x((d) => xScale(d.data.date))
			.y((d) => yScale(d[1]))
			.curve(d3.curveCardinal.tension(0.3))
	);

	/* ── X-axis ticks ─────────────────────────────── */

	let xTicks = $derived(xScale.ticks(d3.timeMonth.every(1)!));

	/* ── Tooltip state ────────────────────────────── */

	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipVisible = $state(false);
	let tooltipStreamName = $state('');
	let tooltipValue = $state(0);

	function handleStreamEnter(streamDef: StreamDef) {
		hoveredStream = streamDef.id;
	}

	function handleStreamLeave() {
		hoveredStream = null;
		tooltipVisible = false;
	}

	function handleStreamMove(event: PointerEvent, layerIndex: number) {
		const svgRect = containerEl?.querySelector('svg')?.getBoundingClientRect();
		if (!svgRect) return;

		const mouseX = event.clientX - svgRect.left;
		const date = xScale.invert(mouseX);

		// Find nearest data point
		const bisector = d3.bisector<TimeSeriesData, Date>((d) => d.date).left;
		const idx = Math.min(bisector(data, date), data.length - 1);
		const layer = stackedData[layerIndex];
		if (!layer || !layer[idx]) return;

		const stream = streams[layerIndex];
		const val = (data[idx][stream.id] as number) ?? 0;

		tooltipX = event.clientX;
		tooltipY = event.clientY;
		tooltipStreamName = stream.name;
		tooltipValue = Math.round(val * 10) / 10;
		tooltipVisible = true;
	}

	/* ── Keyboard nav ─────────────────────────────── */

	function handleStreamKeydown(event: KeyboardEvent, streamDef: StreamDef) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			hoveredStream = hoveredStream === streamDef.id ? null : streamDef.id;
		}
	}

	/* ── Moment marker positioning ────────────────── */

	function getMomentY(moment: MomentMarker): number {
		const streamIdx = streams.findIndex((s) => s.id === moment.streamId);
		if (streamIdx === -1) return height / 2;

		const layer = stackedData[streamIdx];
		if (!layer) return height / 2;

		const bisector = d3.bisector<TimeSeriesData, Date>((d) => d.date).left;
		const idx = Math.min(bisector(data, moment.date), data.length - 1);
		const point = layer[idx];
		if (!point) return height / 2;

		return yScale((point[0] + point[1]) / 2);
	}

	function getMomentColor(moment: MomentMarker): string {
		const stream = streams.find((s) => s.id === moment.streamId);
		return stream?.color ?? 'var(--text-primary)';
	}

	/* ── Stream state class ──────────────────────── */

	function streamState(streamId: string): string {
		if (!hoveredStream) return 'default';
		if (hoveredStream === streamId) return 'hovered';
		return 'dimmed';
	}
</script>

<div
	class="stream-graph-container"
	class:reduced-motion={prefersReducedMotion}
	bind:this={containerEl}
>
	<svg
		class="stream-graph-svg"
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		role="img"
		aria-label="Stream graph showing interest evolution over time across {streams.length} topics"
	>
		<!-- ── SVG Defs ─────────────────────────────── -->
		<defs>
			<!-- Glow filter for moment markers -->
			<filter id="moment-glow" x="-200%" y="-200%" width="500%" height="500%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
				<feComposite in="blur" in2="SourceGraphic" operator="over" />
			</filter>

			<!-- Edge glow filter -->
			<filter id="edge-glow" x="-10%" y="-10%" width="120%" height="120%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
				<feComposite in="blur" in2="SourceGraphic" operator="over" />
			</filter>

			<!-- Linear gradients for each stream -->
			{#each streams as stream (stream.id)}
				<linearGradient id="stream-fill-{stream.id}" x1="0" y1="1" x2="0" y2="0">
					<stop offset="0%" stop-color={stream.color} stop-opacity="0.30" />
					<stop offset="100%" stop-color={stream.color} stop-opacity="0.10" />
				</linearGradient>
			{/each}
		</defs>

		<!-- ── Stream layers ────────────────────────── -->
		{#each stackedData as layer, i (streams[i].id)}
			{@const stream = streams[i]}
			{@const state = streamState(stream.id)}
			<g
				class="stream-layer"
				class:stream-hovered={state === 'hovered'}
				class:stream-dimmed={state === 'dimmed'}
				data-stream={stream.id}
				role="button"
				tabindex="0"
				aria-label="{stream.name} interest stream"
				onpointerenter={() => handleStreamEnter(stream)}
				onpointerleave={handleStreamLeave}
				onpointermove={(e) => handleStreamMove(e, i)}
				onkeydown={(e) => handleStreamKeydown(e, stream)}
			>
				<!-- Filled area -->
				<path
					class="stream-area"
					d={areaGenerator(layer) ?? ''}
					fill="url(#stream-fill-{stream.id})"
				/>

				<!-- Upper edge stroke -->
				<path
					class="stream-edge"
					d={upperEdgeGenerator(layer) ?? ''}
					stroke={stream.color}
					fill="none"
					filter="url(#edge-glow)"
				/>
			</g>
		{/each}

		<!-- ── Moment markers ──────────────────────── -->
		{#each moments as moment, idx (idx)}
			{@const mx = xScale(moment.date)}
			{@const my = getMomentY(moment)}
			{@const mcolor = getMomentColor(moment)}
			<g class="moment-marker" aria-label="Moment: {moment.label}">
				<!-- Vertical dashed line -->
				<line
					x1={mx}
					y1={my}
					x2={mx}
					y2={height - margin.bottom}
					stroke={mcolor}
					stroke-opacity="0.2"
					stroke-width="1"
					stroke-dasharray="3 4"
				/>

				<!-- Glow circle -->
				<circle
					cx={mx}
					cy={my}
					r="5"
					fill={mcolor}
					filter="url(#moment-glow)"
					opacity="0.8"
				/>

				<!-- Core dot -->
				<circle cx={mx} cy={my} r="3" fill={mcolor} />

				<!-- Label -->
				<text
					class="moment-label"
					x={mx}
					y={my - 14}
					text-anchor="middle"
					fill={mcolor}
				>
					{moment.label}
				</text>
			</g>
		{/each}

		<!-- ── X-axis: month labels ────────────────── -->
		{#each xTicks as tick (tick.getTime())}
			<text
				class="x-tick"
				x={xScale(tick)}
				y={height - 8}
				text-anchor="middle"
			>
				{d3.timeFormat('%b')(tick)}
			</text>
		{/each}
	</svg>

	<!-- ── Screen reader summary ──────────────── -->
	<div class="sr-only" aria-live="polite">
		Stream graph showing {streams.length} interest areas over time. Top interests: {streams.slice(0, 2).map(s => s.name).join(', ')}.
	</div>

	<!-- ── Tooltip ──────────────────────────────── -->
	{#if tooltipVisible && hoveredStream}
		<div
			class="stream-tooltip"
			style="left: {tooltipX + 14}px; top: {tooltipY - 30}px"
		>
			<span class="stream-tooltip-name">{tooltipStreamName}</span>
			<span class="stream-tooltip-value">{tooltipValue} saves/week</span>
		</div>
	{/if}
</div>

<style>
	/* ── Container ──────────────────────────────────── */
	.stream-graph-container {
		position: relative;
		width: 100%;
	}

	.stream-graph-svg {
		display: block;
		width: 100%;
		height: 320px;
	}

	/* ── Stream layers ──────────────────────────────── */
	.stream-layer {
		cursor: pointer;
		outline: none;
	}

	.stream-area {
		opacity: 1;
		transition: opacity var(--duration-normal) var(--ease-out),
			filter var(--duration-normal) var(--ease-out);
	}

	.stream-edge {
		stroke-width: 1.5;
		stroke-opacity: 0.6;
		transition: stroke-opacity var(--duration-normal) var(--ease-out),
			filter var(--duration-normal) var(--ease-out);
	}

	/* Hovered state */
	.stream-hovered .stream-area {
		filter: brightness(1.15);
	}

	.stream-hovered .stream-edge {
		stroke-opacity: 0.9;
		stroke-width: 2;
	}

	/* Dimmed state */
	.stream-dimmed .stream-area {
		opacity: 0.25;
	}

	.stream-dimmed .stream-edge {
		stroke-opacity: 0.15;
	}

	/* Focus visible */
	.stream-layer:focus-visible .stream-edge {
		stroke-opacity: 1;
		stroke-width: 2.5;
	}

	/* ── Moment markers ─────────────────────────────── */
	.moment-marker {
		pointer-events: none;
	}

	.moment-label {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		font-weight: 500;
		letter-spacing: 0.02em;
		opacity: 0.75;
	}

	/* ── X-axis ticks ───────────────────────────────── */
	.x-tick {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		fill: var(--text-tertiary);
		user-select: none;
	}

	/* ── Tooltip ─────────────────────────────────────── */
	.stream-tooltip {
		position: fixed;
		z-index: 500;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-xs) var(--space-sm);
		background: rgba(15, 15, 16, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.stream-tooltip-name {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
	}

	.stream-tooltip-value {
		font-family: var(--font-body);
		font-size: var(--text-xs);
		color: var(--text-secondary);
	}

	/* ── Screen reader only ────────────────────────────── */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* ── Reduced motion ──────────────────────────────── */
	.reduced-motion .stream-area,
	.reduced-motion .stream-edge {
		transition: none;
	}
</style>
