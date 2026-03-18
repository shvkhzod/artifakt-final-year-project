<script lang="ts">
	import { onMount } from 'svelte';
	import ConstellationMap from '$lib/components/tastemap/ConstellationMap.svelte';
	import DetailPanel from '$lib/components/tastemap/DetailPanel.svelte';
	import type { Item, Cluster, ItemType } from '$lib/utils/types';
	import * as appStore from '$lib/stores/appStore.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	// Accept server data if available (from +page.server.ts)
	let { data }: { data?: { nodes?: any[]; clusters?: any[] } } = $props();

	// Use server data
	let nodes = $derived(data?.nodes ?? []);
	let clusters = $derived(data?.clusters ?? {});

	/* ── Selection state ──────────────────────────── */

	let selectedItem: Item | null = $state(null);
	let selectedCluster: Cluster | null = $state(null);

	function handleSelectNode(item: Item, cluster: Cluster | null) {
		selectedItem = item;
		selectedCluster = cluster;
		if (cluster) {
			appStore.setSearchContext({
				page: 'tastemap',
				clusterId: cluster.id,
				clusterName: cluster.name,
				clusterColor: cluster.color,
			});
		}
	}

	function handleCloseDetail() {
		selectedItem = null;
		selectedCluster = null;
		appStore.setSearchContext({ page: 'tastemap' });
	}

	onMount(() => {
		appStore.setSearchContext({ page: 'tastemap' });
	});

	/* ── Counts ───────────────────────────────────── */

	const itemCount = nodes.length;
	const clusterCount = typeof clusters === 'object' ? Object.keys(clusters).length : 0;
</script>

<svelte:head>
	<title>Taste Map — Aina</title>
</svelte:head>

<!-- Full-screen dark canvas -->
<div class="tastemap-page">
	{#if nodes.length === 0}<EmptyState heading="Not enough data yet" subtitle="Save a few items and your taste map will emerge" />{:else}
	<!-- Stats badge -->
	<div class="stats-badge">
		<span class="item-count">{itemCount} items · {clusterCount} clusters</span>
	</div>

	<!-- Constellation visualization -->
	<ConstellationMap
		{nodes}
		onSelectNode={handleSelectNode}
	/>

	<!-- Detail panel -->
	<DetailPanel
		item={selectedItem}
		cluster={selectedCluster}
		onClose={handleCloseDetail}
	/>

	<!-- Zoom hint (fades out) -->
	<div class="zoom-hint">
		Scroll to zoom · Drag to pan · Click a star to inspect
	</div>
	{/if}
</div>

<style>
	/* ── Page Container ─────────────────────────────── */
	.tastemap-page {
		position: fixed;
		inset: 0;
		background: var(--bg-void);
		overflow: hidden;
	}

	/* ── Stats Badge ────────────────────────────────── */
	.stats-badge {
		position: fixed;
		top: 68px;
		right: var(--space-lg);
		z-index: var(--z-fab);
		pointer-events: none;
	}

	.item-count {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		backdrop-filter: blur(12px);
		padding: 4px 12px;
		border-radius: var(--radius-full);
		user-select: none;
	}

	/* ── Zoom Hint ──────────────────────────────────── */
	.zoom-hint {
		position: fixed;
		bottom: var(--space-xl);
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-fab);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		background: rgba(15, 15, 16, 0.7);
		backdrop-filter: blur(8px);
		padding: var(--space-xs) var(--space-md);
		border-radius: var(--radius-full);
		border: 1px solid var(--border-subtle);
		pointer-events: none;
		user-select: none;
		animation: hintFadeOut 6s var(--ease-out) forwards;
	}

	@keyframes hintFadeOut {
		0%,
		70% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}
</style>
