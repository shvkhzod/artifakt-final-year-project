<script lang="ts">
	interface ActivityDay {
		date: Date;
		count: number;
	}

	interface Props {
		data: ActivityDay[];
	}

	let { data }: Props = $props();

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

	/* ── Grid layout ─────────────────────────────── */

	const cellSize = 10;
	const cellGap = 2;
	const step = cellSize + cellGap;
	const dayLabelWidth = 28;
	const headerHeight = 18;

	/* ── Build grid from data ────────────────────── */

	interface GridCell {
		date: Date;
		count: number;
		col: number;
		row: number;
	}

	let grid = $derived(() => {
		if (data.length === 0) return { cells: [] as GridCell[], weekCount: 0, months: [] as { label: string; col: number }[] };

		// Sort by date
		const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
		const startDate = sorted[0].date;

		// Build lookup
		const lookup = new Map<string, number>();
		for (const d of sorted) {
			const key = `${d.date.getFullYear()}-${d.date.getMonth()}-${d.date.getDate()}`;
			lookup.set(key, d.count);
		}

		const cells: GridCell[] = [];
		const months: { label: string; col: number }[] = [];
		let lastMonth = -1;

		// Start from the first Sunday on or before startDate
		const firstDay = new Date(startDate);
		firstDay.setDate(firstDay.getDate() - firstDay.getDay());

		const endDate = sorted[sorted.length - 1].date;
		const current = new Date(firstDay);
		let col = 0;

		while (current <= endDate) {
			const row = current.getDay();
			if (row === 0 && current > firstDay) col++;

			const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
			const count = lookup.get(key) ?? 0;

			// Track months
			if (current.getMonth() !== lastMonth && row <= 1) {
				const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
				months.push({ label: monthNames[current.getMonth()], col });
				lastMonth = current.getMonth();
			}

			cells.push({ date: new Date(current), count, col, row });
			current.setDate(current.getDate() + 1);
		}

		return { cells, weekCount: col + 1, months };
	});

	let svgWidth = $derived(dayLabelWidth + grid().weekCount * step + 4);
	let svgHeight = headerHeight + 7 * step + 4;

	/* ── Color scale ─────────────────────────────── */

	function cellColor(count: number): string {
		if (count === 0) return 'rgba(255, 255, 255, 0.03)';
		if (count === 1) return 'rgba(123, 158, 135, 0.15)';
		if (count <= 3) return 'rgba(123, 158, 135, 0.30)';
		if (count <= 6) return 'rgba(123, 158, 135, 0.50)';
		return 'rgba(123, 158, 135, 0.80)';
	}

	/* ── Tooltip ──────────────────────────────────── */

	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipDate = $state('');
	let tooltipCount = $state(0);

	function handleCellEnter(cell: GridCell, event: PointerEvent) {
		tooltipVisible = true;
		tooltipX = event.clientX;
		tooltipY = event.clientY;
		tooltipDate = cell.date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
		tooltipCount = cell.count;
	}

	function handleCellLeave() {
		tooltipVisible = false;
	}

	/* ── Day labels ──────────────────────────────── */

	const dayLabels = [
		{ label: 'Mon', row: 1 },
		{ label: 'Wed', row: 3 },
		{ label: 'Fri', row: 5 },
	];

	/* ── Keyboard navigation ─────────────────────── */

	let focusedCellIndex: number = $state(-1);

	function handleHeatmapKeydown(event: KeyboardEvent) {
		const cells = grid().cells;
		if (cells.length === 0) return;

		let newIndex = focusedCellIndex;

		switch (event.key) {
			case 'ArrowRight':
				event.preventDefault();
				newIndex = Math.min(focusedCellIndex + 1, cells.length - 1);
				break;
			case 'ArrowLeft':
				event.preventDefault();
				newIndex = Math.max(focusedCellIndex - 1, 0);
				break;
			case 'ArrowDown':
				event.preventDefault();
				// Move down one row (7 days ahead)
				newIndex = Math.min(focusedCellIndex + 7, cells.length - 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				// Move up one row (7 days back)
				newIndex = Math.max(focusedCellIndex - 7, 0);
				break;
			case 'Home':
				event.preventDefault();
				newIndex = 0;
				break;
			case 'End':
				event.preventDefault();
				newIndex = cells.length - 1;
				break;
			default:
				return;
		}

		if (newIndex !== focusedCellIndex) {
			focusedCellIndex = newIndex;
			// Focus the rect element
			const svg = containerEl?.querySelector('svg');
			const rects = svg?.querySelectorAll<SVGRectElement>('.heatmap-cell');
			rects?.[newIndex]?.focus();
		}
	}

	let containerEl: HTMLDivElement | undefined = $state();
</script>

<div
	class="heatmap-container"
	class:reduced-motion={prefersReducedMotion}
	bind:this={containerEl}
	role="grid"
	tabindex="0"
	aria-label="Activity heatmap"
	onkeydown={handleHeatmapKeydown}
>
	<svg
		class="heatmap-svg"
		width={svgWidth}
		height={svgHeight}
		viewBox="0 0 {svgWidth} {svgHeight}"
		role="img"
		aria-label="Activity heatmap showing daily save counts over the past year"
	>
		<!-- Month labels -->
		{#each grid().months as month (month.label + '-' + month.col)}
			<text
				class="month-label"
				x={dayLabelWidth + month.col * step}
				y={12}
			>
				{month.label}
			</text>
		{/each}

		<!-- Day labels -->
		{#each dayLabels as day (day.row)}
			<text
				class="day-label"
				x={0}
				y={headerHeight + day.row * step + cellSize - 1}
			>
				{day.label}
			</text>
		{/each}

		<!-- Cells -->
		{#each grid().cells as cell, idx (cell.date.getTime())}
			<rect
				class="heatmap-cell"
				x={dayLabelWidth + cell.col * step}
				y={headerHeight + cell.row * step}
				width={cellSize}
				height={cellSize}
				rx="2"
				ry="2"
				fill={cellColor(cell.count)}
				role="gridcell"
				tabindex={idx === Math.max(0, focusedCellIndex) ? 0 : -1}
				aria-label="{cell.count} {cell.count === 1 ? 'item' : 'items'} saved on {cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}"
				onpointerenter={(e) => handleCellEnter(cell, e)}
				onpointerleave={handleCellLeave}
				onfocus={() => { focusedCellIndex = idx; }}
			/>
		{/each}
	</svg>

	<!-- Tooltip -->
	{#if tooltipVisible}
		<div
			class="heatmap-tooltip"
			style="left: {tooltipX + 12}px; top: {tooltipY - 36}px"
		>
			<span class="heatmap-tooltip-count">
				{tooltipCount === 0 ? 'No saves' : tooltipCount === 1 ? '1 save' : `${tooltipCount} saves`}
			</span>
			<span class="heatmap-tooltip-date">{tooltipDate}</span>
		</div>
	{/if}
</div>

<style>
	/* ── Container ──────────────────────────────────── */
	.heatmap-container {
		position: relative;
		overflow-x: auto;
		padding-bottom: var(--space-xs);
	}

	.heatmap-svg {
		display: block;
	}

	/* ── Month labels ───────────────────────────────── */
	.month-label {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		fill: var(--text-tertiary);
		user-select: none;
	}

	/* ── Day labels ──────────────────────────────────── */
	.day-label {
		font-family: var(--font-body);
		font-size: var(--text-2xs);
		fill: var(--text-ghost);
		user-select: none;
	}

	/* ── Cells ────────────────────────────────────────── */
	.heatmap-cell {
		transition: opacity var(--duration-fast) var(--ease-out);
		cursor: pointer;
	}

	.heatmap-cell:hover {
		opacity: 0.8;
		stroke: rgba(255, 255, 255, 0.15);
		stroke-width: 1;
	}

	.heatmap-cell:focus-visible {
		outline: none;
		stroke: var(--accent-sage);
		stroke-width: 2;
	}

	/* ── Tooltip ──────────────────────────────────────── */
	.heatmap-tooltip {
		position: fixed;
		z-index: var(--z-navbar);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 4px 8px;
		background: rgba(15, 15, 16, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.heatmap-tooltip-count {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--text-primary);
	}

	.heatmap-tooltip-date {
		font-size: var(--text-2xs);
		color: var(--text-tertiary);
	}

	/* ── Reduced motion ──────────────────────────────── */
	.reduced-motion .heatmap-cell {
		transition: none;
	}
</style>
