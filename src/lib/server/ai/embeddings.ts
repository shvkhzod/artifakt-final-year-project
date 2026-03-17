import { pipeline } from '@xenova/transformers';
import type { EmbeddingResult } from '$lib/utils/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textPipeline: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let imagePipeline: any = null;

async function getTextPipeline() {
	if (!textPipeline) {
		textPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
	}
	return textPipeline;
}

async function getImagePipeline() {
	if (!imagePipeline) {
		imagePipeline = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
	}
	return imagePipeline;
}

function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
	if (magnitude === 0) return vector;
	return vector.map((val) => val / magnitude);
}

function padVector(vector: number[], targetDim: number): number[] {
	if (vector.length >= targetDim) return vector.slice(0, targetDim);
	return [...vector, ...new Array(targetDim - vector.length).fill(0)];
}

export async function generateTextEmbedding(text: string): Promise<EmbeddingResult> {
	const extractor = await getTextPipeline();
	const output = await extractor(text, { pooling: 'mean', normalize: true });
	const rawVector = Array.from(output.data as Float32Array);
	const normalized = normalizeVector(rawVector);
	const padded = padVector(normalized, 512);

	return {
		vector: padded,
		model: 'all-MiniLM-L6-v2',
		dimensions: 512,
	};
}

export async function generateImageEmbedding(imageUrl: string): Promise<EmbeddingResult> {
	const extractor = await getImagePipeline();
	const output = await extractor(imageUrl);
	const rawVector = Array.from(output.data as Float32Array);
	const normalized = normalizeVector(rawVector);

	return {
		vector: normalized,
		model: 'clip-vit-base-patch32',
		dimensions: 512,
	};
}

export async function generateEmbeddingForItem(item: {
	type: string;
	title?: string | null;
	content?: string | null;
	url?: string | null;
	thumbnailUrl?: string | null;
}): Promise<EmbeddingResult> {
	if (
		(item.type === 'image' || item.type === 'screenshot') &&
		(item.url || item.thumbnailUrl)
	) {
		const imageUrl = item.url || item.thumbnailUrl;
		return generateImageEmbedding(imageUrl!);
	}

	const textParts: string[] = [];
	if (item.title) textParts.push(item.title);
	if (item.content) textParts.push(item.content);

	const text = textParts.join('. ') || 'untitled item';
	return generateTextEmbedding(text);
}

export async function generateAndStoreEmbedding(
	itemId: string,
	item: {
		type: string;
		title?: string | null;
		content?: string | null;
		url?: string | null;
		thumbnailUrl?: string | null;
	},
): Promise<void> {
	const { updateItemEmbedding } = await import('$lib/server/db/queries');
	const result = await generateEmbeddingForItem(item);
	await updateItemEmbedding(itemId, result.vector);
	console.log(
		`Embedding stored for item ${itemId} using ${result.model} (${result.dimensions}d)`,
	);
}
