<script lang="ts">
	import ConstellationMap from '$lib/components/tastemap/ConstellationMap.svelte';
	import DetailPanel from '$lib/components/tastemap/DetailPanel.svelte';
	import type { Item, Cluster, ItemType } from '$lib/utils/types';
	import { CLUSTER_COLORS } from '$lib/utils/colors';

	// Accept server data if available (from +page.server.ts)
	let { data }: { data?: { nodes?: any[]; clusters?: any[] } } = $props();

	/* ── Demo clusters ────────────────────────────── */

	const demoClusters: Record<string, Cluster> = {
		visual: {
			id: 'cluster-visual',
			name: 'Visual Aesthetics',
			color: CLUSTER_COLORS.amber,
			description: 'Photography, visual art, and spatial compositions',
			itemCount: 7,
			createdAt: new Date('2025-09-01'),
		},
		design: {
			id: 'cluster-design',
			name: 'Design Philosophy',
			color: CLUSTER_COLORS.cyan,
			description: 'Craft, simplicity, and intentional making',
			itemCount: 5,
			createdAt: new Date('2025-09-15'),
		},
		tech: {
			id: 'cluster-tech',
			name: 'Technology',
			color: CLUSTER_COLORS.emerald,
			description: 'Tools, AI, and local-first thinking',
			itemCount: 5,
			createdAt: new Date('2025-10-01'),
		},
		literature: {
			id: 'cluster-literature',
			name: 'Literature',
			color: CLUSTER_COLORS.mauve,
			description: 'Seeing, knowing, and the garden of ideas',
			itemCount: 3,
			createdAt: new Date('2025-10-10'),
		},
	};

	/* ── Demo items ───────────────────────────────── */

	function makeItem(
		id: string,
		type: ItemType,
		title: string | null,
		content: string | null,
		url: string | null,
		note: string | null
	): Item {
		return {
			id,
			type,
			title,
			content,
			url,
			thumbnailUrl: null,
			note,
			embedding: null,
			colorPalette: null,
			createdAt: new Date('2025-11-15'),
			updatedAt: new Date('2025-11-15'),
		};
	}

	interface MapNodeInput {
		id: string;
		item: Item;
		cluster: Cluster | null;
	}

	const demoNodes: MapNodeInput[] = [
		{ id: '1', item: makeItem('1', 'image', 'Morning Light on Concrete', null, 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600', null), cluster: demoClusters.visual },
		{ id: '2', item: makeItem('2', 'image', 'Foggy Mountain Ridge', null, 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600', null), cluster: demoClusters.visual },
		{ id: '3', item: makeItem('3', 'image', 'Tokyo Alleyway', null, 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', null), cluster: demoClusters.visual },
		{ id: '4', item: makeItem('4', 'image', 'Minimalist Interior', null, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', null), cluster: demoClusters.visual },
		{ id: '5', item: makeItem('5', 'image', 'Abstract Color Field', null, 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400', null), cluster: demoClusters.visual },
		{ id: '6', item: makeItem('6', 'image', 'Weathered Typography', null, 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=200', null), cluster: demoClusters.visual },
		{ id: '20', item: makeItem('20', 'image', 'Light Study', null, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', null), cluster: demoClusters.visual },
		{ id: '7', item: makeItem('7', 'quote', 'On Simplicity', 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', null, 'Antoine de Saint-Exupery'), cluster: demoClusters.design },
		{ id: '8', item: makeItem('8', 'quote', 'On Craft', 'The details are not the details. They make the design.', null, 'Charles Eames'), cluster: demoClusters.design },
		{ id: '10', item: makeItem('10', 'article', 'The Shape of Design', 'Frank Chimero explores how design is not just problem-solving but a way of contributing to the world.', 'shapeofdesignbook.com', null), cluster: demoClusters.design },
		{ id: '12', item: makeItem('12', 'article', 'A Handmade Web', 'J.R. Carpenter argues for websites crafted with care, intention, and human touch.', 'luckysoap.com', null), cluster: demoClusters.design },
		{ id: '19', item: makeItem('19', 'article', 'How Buildings Learn', 'Stewart Brand on how buildings adapt and change over time, and what that teaches us about design.', 'goodreads.com', null), cluster: demoClusters.design },
		{ id: '18', item: makeItem('18', 'quote', 'On Technology', 'Any sufficiently advanced technology is indistinguishable from magic.', null, 'Arthur C. Clarke'), cluster: demoClusters.tech },
		{ id: '11', item: makeItem('11', 'article', 'Attention Is All You Need', 'The landmark paper introducing the Transformer architecture that revolutionized NLP.', 'arxiv.org', null), cluster: demoClusters.tech },
		{ id: '13', item: makeItem('13', 'article', 'Local-First Software', 'A new paradigm that keeps data on the user\'s device while enabling collaboration.', 'inkandswitch.com', null), cluster: demoClusters.tech },
		{ id: '14', item: makeItem('14', 'screenshot', 'Linear App — Issue Board', null, 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400', null), cluster: demoClusters.tech },
		{ id: '16', item: makeItem('16', 'screenshot', 'VS Code — Monokai', null, 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300', null), cluster: demoClusters.tech },
		{ id: '9', item: makeItem('9', 'quote', 'On Seeing', 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.', null, 'Marcel Proust'), cluster: demoClusters.literature },
		{ id: '15', item: makeItem('15', 'quote', 'On Knowledge', 'The only true wisdom is in knowing you know nothing.', null, 'Socrates'), cluster: demoClusters.literature },
		{ id: '21', item: makeItem('21', 'article', 'The Garden and the Stream', 'Mike Caulfield on the difference between the garden (timeless, connected) and the stream (ephemeral, linear).', 'hapgood.us', null), cluster: demoClusters.literature },
	];

	// Use server data if available, otherwise demo
	let nodes = $derived((data?.nodes && data.nodes.length > 0) ? data.nodes : demoNodes);
	let clusters = $derived((data?.clusters && Object.keys(data.clusters).length > 0)
		? data.clusters
		: demoClusters);

	/* ── Selection state ──────────────────────────── */

	let selectedItem: Item | null = $state(null);
	let selectedCluster: Cluster | null = $state(null);

	function handleSelectNode(item: Item, cluster: Cluster | null) {
		selectedItem = item;
		selectedCluster = cluster;
	}

	function handleCloseDetail() {
		selectedItem = null;
		selectedCluster = null;
	}

	/* ── Counts ───────────────────────────────────── */

	const itemCount = nodes.length;
	const clusterCount = typeof clusters === 'object' ? Object.keys(clusters).length : 0;
</script>

<svelte:head>
	<title>Taste Map — Aina</title>
</svelte:head>

<!-- Full-screen dark canvas -->
<div class="tastemap-page">
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
		z-index: 200;
		pointer-events: none;
	}

	.item-count {
		font-family: var(--font-body);
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
		z-index: 200;
		font-family: var(--font-body);
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
