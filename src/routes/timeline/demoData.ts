// Fake data for screenshot mockups. Triggered by ?demo=1 on the timeline route.
// Not used in real flows.

function seeded(n: number): number {
	const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}

const STREAMS = [
	{ id: 'arch', name: 'Architecture & Space', color: '#E69F00' },
	{ id: 'type', name: 'Editorial Typography', color: '#56B4E9' },
	{ id: 'film', name: 'Film Stills', color: '#009E73' },
	{ id: 'ui', name: 'Interface Design', color: '#0072B2' },
	{ id: 'photo', name: 'Quiet Photography', color: '#D55E00' },
	{ id: 'sound', name: 'Ambient Sound', color: '#CC79A7' },
];

const SHAPES: Record<string, (w: number) => number> = {
	arch: (w) =>
		Math.max(
			0,
			Math.round(
				2 + 1.6 * Math.sin(w / 8) + (w > 30 && w < 50 ? 3 : 0) + (w > 60 ? 2.2 : 0),
			),
		),
	type: (w) =>
		Math.max(
			0,
			Math.round(w < 20 ? 0.3 + seeded(w) * 0.4 : 1 + (w - 20) / 11 + Math.sin(w / 4) * 0.8),
		),
	film: (w) =>
		Math.max(
			0,
			Math.round(4.2 - w / 20 + Math.sin(w / 3) * 0.9 + (w > 70 ? 1.4 : 0)),
		),
	ui: (w) => Math.max(0, Math.round(0.5 + w / 28 + Math.cos(w / 5) * 0.7)),
	photo: (w) =>
		Math.max(0, Math.round(w > 20 && w < 60 ? 1.6 + Math.sin(w / 3.5) * 1.2 : 0)),
	sound: (w) => Math.max(0, Math.round(1 + Math.sin(w / 6) * 0.5 + (seeded(w) > 0.85 ? 1 : 0))),
};

export function buildDemoData() {
	const now = new Date();

	// Most recent Monday
	const lastMonday = new Date(now);
	const dow = lastMonday.getDay();
	lastMonday.setDate(lastMonday.getDate() - (dow === 0 ? 6 : dow - 1));
	lastMonday.setHours(0, 0, 0, 0);

	// 78 weeks (~18 months) of stream data
	const weekCount = 78;
	const weeks: Array<Record<string, number | string>> = [];

	for (let i = 0; i < weekCount; i++) {
		const d = new Date(lastMonday);
		d.setDate(d.getDate() - (weekCount - 1 - i) * 7);
		const entry: Record<string, number | string> = {
			date: d.toISOString().split('T')[0],
		};
		for (const s of STREAMS) {
			entry[s.id] = SHAPES[s.id](i);
		}
		weeks.push(entry);
	}

	// 365 days of activity for the heatmap
	const dayCount = 365;
	const heatmapData: Array<{ date: string; count: number }> = [];

	for (let i = 0; i < dayCount; i++) {
		const d = new Date(now);
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() - (dayCount - 1 - i));
		const dow2 = d.getDay();
		const weekendBoost = dow2 === 0 || dow2 === 6 ? 0.25 : 0;
		const seasonal = Math.sin(i / 38) * 0.18;
		const baseProb = 0.42 + weekendBoost + seasonal;
		const r = seeded(i + 7);
		let count = 0;
		if (r < baseProb) {
			const r2 = seeded(i + 1011);
			count = 1 + Math.floor(r2 * 4) + (r2 > 0.88 ? 4 : 0);
		}
		heatmapData.push({ date: d.toISOString().split('T')[0], count });
	}

	const totalItems = heatmapData.reduce((sum, d) => sum + d.count, 0);

	const insights = [
		{
			type: 'taste_shift',
			color: '#56B4E9',
			title: 'A new lens forming',
			description:
				"Your saves around editorial typography have grown 4× this quarter, often paired with architectural references — a thread that didn't exist six months ago.",
		},
		{
			type: 'new_interest',
			color: '#E69F00',
			title: 'Brutalist architecture',
			description: '47 saves of concrete-era buildings since February. Strongest cluster in months.',
		},
		{
			type: 'palette_change',
			color: '#CC79A7',
			title: 'Quieter palette',
			description:
				'Saved images have shifted toward muted tones — fewer reds, more cool grays.',
		},
		{
			type: 'milestone',
			color: '#7B9E87',
			title: '500 items saved',
			description:
				'You crossed 500 on April 12. Half of them sit in three clusters.',
		},
		{
			type: 'taste_shift',
			color: '#009E73',
			title: 'Film stills receding',
			description:
				'Once your most-saved category, film references are down 60% from last summer.',
		},
	];

	const moments = [
		{ date: weeks[15].date as string, label: 'First Bauhaus save', streamId: 'arch' },
		{ date: weeks[42].date as string, label: 'Editorial pivot', streamId: 'type' },
		{ date: weeks[64].date as string, label: '500 items', streamId: 'arch' },
	];

	return {
		weeks,
		streams: STREAMS,
		clusters: STREAMS.map((s) => ({
			id: s.id,
			name: s.name,
			color: s.color,
			description: null,
			source: 'ai' as const,
			itemCount: 0,
			createdAt: new Date(),
		})),
		items: [],
		heatmapData,
		insights,
		moments,
		totalItems,
	};
}
