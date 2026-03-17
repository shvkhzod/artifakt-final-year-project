import { getClusterColor } from './colors';

export interface DemoItem {
	id: string;
	type: 'image' | 'article' | 'quote' | 'screenshot';
	title: string | null;
	content: string | null;
	url: string | null;
	thumbnailUrl: string | null;
	note: string | null;
	clusterName: string;
}

const items: DemoItem[] = [
	{ id: '1', type: 'image', title: 'Morning Light on Concrete', content: null, url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '2', type: 'image', title: 'Foggy Mountain Ridge', content: null, url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '3', type: 'image', title: 'Tokyo Alleyway at Night', content: null, url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '4', type: 'image', title: 'Minimalist Interior', content: null, url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '5', type: 'image', title: 'Abstract Color Field', content: null, url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '6', type: 'image', title: 'Weathered Typography', content: null, url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=200', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '7', type: 'quote', title: 'On Simplicity', content: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.', url: null, thumbnailUrl: null, note: 'Antoine de Saint-Exupéry', clusterName: 'Design Philosophy' },
	{ id: '8', type: 'quote', title: 'On Craft', content: 'The details are not the details. They make the design.', url: null, thumbnailUrl: null, note: 'Charles Eames', clusterName: 'Design Philosophy' },
	{ id: '9', type: 'quote', title: 'On Seeing', content: 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.', url: null, thumbnailUrl: null, note: 'Marcel Proust', clusterName: 'Literature' },
	{ id: '10', type: 'article', title: 'The Shape of Design', content: 'Frank Chimero explores how design is not just problem-solving but a way of contributing to the world.', url: 'shapeofdesignbook.com', thumbnailUrl: null, note: null, clusterName: 'Design Philosophy' },
	{ id: '11', type: 'article', title: 'Attention Is All You Need', content: 'The landmark paper introducing the Transformer architecture that revolutionized NLP.', url: 'arxiv.org', thumbnailUrl: null, note: null, clusterName: 'Technology' },
	{ id: '12', type: 'article', title: 'A Handmade Web', content: 'J.R. Carpenter argues for websites crafted with care, intention, and human touch.', url: 'luckysoap.com', thumbnailUrl: null, note: null, clusterName: 'Design Philosophy' },
	{ id: '13', type: 'article', title: 'Local-First Software', content: 'A new paradigm that keeps data on the user\'s device while enabling collaboration.', url: 'inkandswitch.com', thumbnailUrl: null, note: null, clusterName: 'Technology' },
	{ id: '14', type: 'screenshot', title: 'Linear App — Issue Board', content: null, url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400', thumbnailUrl: null, note: null, clusterName: 'Technology' },
	{ id: '15', type: 'quote', title: 'On Knowledge', content: 'The only true wisdom is in knowing you know nothing.', url: null, thumbnailUrl: null, note: 'Socrates', clusterName: 'Literature' },
	{ id: '16', type: 'screenshot', title: 'VS Code — Monokai', content: null, url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=300', thumbnailUrl: null, note: null, clusterName: 'Technology' },
	{ id: '17', type: 'image', title: null, content: null, url: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200', thumbnailUrl: null, note: null, clusterName: 'Technology' },
	{ id: '18', type: 'quote', title: 'On Technology', content: 'Any sufficiently advanced technology is indistinguishable from magic.', url: null, thumbnailUrl: null, note: 'Arthur C. Clarke', clusterName: 'Technology' },
	{ id: '19', type: 'article', title: 'How Buildings Learn', content: 'Stewart Brand on how buildings adapt and change over time, and what that teaches us about design.', url: 'goodreads.com', thumbnailUrl: null, note: null, clusterName: 'Design Philosophy' },
	{ id: '20', type: 'image', title: 'Light Study', content: null, url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', thumbnailUrl: null, note: null, clusterName: 'Visual Aesthetics' },
	{ id: '21', type: 'article', title: 'The Garden and the Stream', content: 'Mike Caulfield on the difference between the garden (timeless, connected) and the stream (ephemeral, linear).', url: 'hapgood.us', thumbnailUrl: null, note: null, clusterName: 'Literature' },
];

const itemMap = new Map(items.map((i) => [i.id, i]));

export function getDemoItem(id: string) {
	const demo = itemMap.get(id);
	if (!demo) return null;

	const now = new Date();
	return {
		item: {
			id: demo.id,
			type: demo.type,
			title: demo.title,
			content: demo.content,
			url: demo.url,
			thumbnailUrl: demo.thumbnailUrl,
			note: demo.note,
			embedding: null,
			colorPalette: null,
			createdAt: now,
			updatedAt: now,
		},
		tags: [],
		cluster: {
			id: demo.clusterName.toLowerCase().replace(/\s+/g, '-'),
			name: demo.clusterName,
			color: getClusterColor(demo.clusterName),
			description: null,
			itemCount: 0,
			createdAt: now,
			confidence: 0.92,
		},
		similarItems: [],
	};
}
