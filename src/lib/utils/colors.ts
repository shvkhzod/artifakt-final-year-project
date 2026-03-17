/**
 * Cluster color definitions matching CSS tokens in tokens.css.
 * Use these when cluster colors are needed in JavaScript/TypeScript.
 *
 * CSS tokens: --cluster-amber, --cluster-cyan, etc.
 */
export const CLUSTER_COLORS = {
	amber: '#E69F00',
	cyan: '#56B4E9',
	emerald: '#009E73',
	blue: '#0072B2',
	vermillion: '#D55E00',
	mauve: '#CC79A7',
} as const;

/** Map of cluster name → hex color for demo/seed data */
export const CLUSTER_NAME_COLORS: Record<string, string> = {
	'Visual Aesthetics': CLUSTER_COLORS.amber,
	'Design Philosophy': CLUSTER_COLORS.cyan,
	'Technology': CLUSTER_COLORS.emerald,
	'Literature': CLUSTER_COLORS.mauve,
	'Architecture': CLUSTER_COLORS.blue,
	'Music & Sound': CLUSTER_COLORS.vermillion,
};

/**
 * Get a cluster color by name, with a fallback.
 */
export function getClusterColor(name: string): string {
	return CLUSTER_NAME_COLORS[name] ?? CLUSTER_COLORS.amber;
}
