import { readFileSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';
import { AI_CONFIG } from '../config';
import type { EmbeddingProvider } from './provider';

const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';
const CLIP_MODEL = 'jina-clip-v2';
const TEXT_MODEL = 'jina-embeddings-v3';
const MAX_IMAGE_SIZE = 1024;
const MAX_BYTES = 500_000;

interface JinaResponse {
	data: { embedding: number[]; index: number }[];
}

export class ApiEmbeddingProvider implements EmbeddingProvider {
	readonly dimensions = { text: 1024, image: 1024 };

	constructor() {
		if (!AI_CONFIG.jina.apiKey) {
			throw new Error('JINA_API_KEY is required when EMBEDDING_PROVIDER=api');
		}
	}

	async embedText(text: string): Promise<number[]> {
		return this.callJina(TEXT_MODEL, [{ text }]);
	}

	async embedImage(imageUrl: string): Promise<number[]> {
		return this.embedClip(imageUrl, 'image');
	}

	async embedClip(input: string, type: 'text' | 'image'): Promise<number[]> {
		let inputPayload: Record<string, string>;

		if (type === 'text') {
			inputPayload = { text: input };
		} else {
			inputPayload = await this.buildImageInput(input);
		}

		return this.callJina(CLIP_MODEL, [inputPayload]);
	}

	private async callJina(model: string, input: Record<string, string>[]): Promise<number[]> {
		// Retry with exponential backoff on 429 (rate limit). Jina's window is 60s,
		// so wait 8s → 20s → 40s → fail. Keeps demos resilient to brief bursts.
		const delays = [8_000, 20_000, 40_000];

		for (let attempt = 0; attempt <= delays.length; attempt++) {
			const response = await fetch(JINA_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${AI_CONFIG.jina.apiKey}`,
				},
				body: JSON.stringify({
					model,
					input,
					normalized: true,
				}),
			});

			if (response.ok) {
				const result = (await response.json()) as JinaResponse;
				return result.data[0].embedding;
			}

			const body = await response.text();

			if (response.status === 429 && attempt < delays.length) {
				const wait = delays[attempt];
				console.warn(`Jina 429: waiting ${wait / 1000}s before retry ${attempt + 1}/${delays.length}`);
				await new Promise((r) => setTimeout(r, wait));
				continue;
			}

			throw new Error(`Jina API error ${response.status}: ${body}`);
		}

		throw new Error('Jina API: exhausted retries');
	}

	private async buildImageInput(input: string): Promise<Record<string, string>> {
		if (input.startsWith('/uploads/')) {
			const filePath = resolve('static', input.slice(1));
			const raw = readFileSync(filePath);

			let buffer: Buffer;
			if (raw.length > MAX_BYTES) {
				buffer = await sharp(raw)
					.resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, { fit: 'inside' })
					.jpeg({ quality: 80 })
					.toBuffer();
			} else {
				buffer = raw;
			}

			const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
			return { image: base64 };
		}

		return { url: input };
	}
}
