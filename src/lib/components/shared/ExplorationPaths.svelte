<script lang="ts">
	type RelatedItem = {
		id: string;
		title: string | null;
		type: string;
		url: string | null;
		thumbnailUrl: string | null;
	};

	type LaneData = {
		key: string;
		label: string;
		items: RelatedItem[];
	};

	let {
		itemId,
		initialSemantic,
		oncenter,
	}: {
		itemId: string;
		initialSemantic?: RelatedItem[];
		oncenter: (detail: { id: string; title: string | null; type: string }) => void;
	} = $props();

	let loading = $state(true);
	let lanes = $state<LaneData[]>([]);
	let usedInitial = false;

	async function fetchRelated(id: string) {
		loading = true;
		try {
			const res = await fetch(`/api/items/${id}/related`);
			if (!res.ok) {
				lanes = [];
				return;
			}
			const data = await res.json();

			// On first load, prefer initialSemantic if provided
			const semantic =
				!usedInitial && initialSemantic && initialSemantic.length > 0
					? initialSemantic
					: data.semantic;
			usedInitial = true;

			const raw: { key: string; label: string; items: RelatedItem[] }[] = [
				{ key: 'semantic', label: 'Similar', items: semantic ?? [] },
				{ key: 'cluster', label: 'Same cluster', items: data.cluster ?? [] },
				{ key: 'temporal', label: 'Around the same time', items: data.temporal ?? [] },
			];

			lanes = raw.filter((lane) => lane.items.length > 0);
		} catch {
			lanes = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		fetchRelated(itemId);
	});

	function handleCardClick(item: RelatedItem) {
		oncenter({ id: item.id, title: item.title, type: item.type });
	}

	function isVisualType(item: RelatedItem): boolean {
		return (
			(item.type === 'image' || item.type === 'screenshot') &&
			!!(item.url || item.thumbnailUrl)
		);
	}
</script>

{#if loading}
	<div class="exploration-paths">
		{#each Array(3) as _, laneIdx}
			<div class="lane">
				<div class="lane-label shimmer-label"></div>
				<div class="lane-scroll">
					{#each Array(3) as _, cardIdx}
						<div class="shimmer-card" style="animation-delay: {(laneIdx * 3 + cardIdx) * 60}ms"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else if lanes.length > 0}
	<div class="exploration-paths">
		{#each lanes as lane (lane.key)}
			<div class="lane">
				<span class="lane-label">{lane.label}</span>
				<div class="lane-scroll">
					{#each lane.items as item (item.id)}
						<button
							class="path-card"
							type="button"
							onclick={() => handleCardClick(item)}
						>
							{#if isVisualType(item)}
								<img
									class="path-card__image"
									src={item.url || item.thumbnailUrl}
									alt={item.title || 'Related item'}
									loading="lazy"
								/>
							{:else}
								<span class="path-card__title">
									{item.title || item.type}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.exploration-paths {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	/* ── Lane ──────────────────────────────────────── */
	.lane {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.lane-label {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-ghost);
		user-select: none;
	}

	.lane-scroll {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;

		&::-webkit-scrollbar {
			display: none;
		}
	}

	/* ── Card ──────────────────────────────────────── */
	.path-card {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0;
		transition: filter var(--duration-fast) var(--ease-out),
			border-color var(--duration-fast) var(--ease-out);

		&:hover {
			filter: brightness(1.15);
			border-color: var(--border-light);
		}

		&:focus-visible {
			outline: 1px solid var(--text-tertiary);
			outline-offset: 2px;
		}
	}

	.path-card__image {
		display: block;
		height: 48px;
		width: auto;
		border-radius: 4px;
		object-fit: cover;
	}

	.path-card__title {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 12px;
		line-height: 1.3;
		color: var(--text-primary);
		padding: 6px 10px;
		max-width: 120px;
		text-align: left;
	}

	/* ── Shimmer Loading ──────────────────────────── */
	.shimmer-label {
		width: 72px;
		height: 10px;
		border-radius: 3px;
		background: var(--text-ghost);
		opacity: 0.4;
		animation: shimmer-pulse 1.2s var(--ease-in-out) infinite;
	}

	.shimmer-card {
		flex-shrink: 0;
		width: 80px;
		height: 48px;
		border-radius: var(--radius-sm);
		background: var(--bg-surface-2);
		animation: shimmer-pulse 1.2s var(--ease-in-out) infinite;
	}

	@keyframes shimmer-pulse {
		0%, 100% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
