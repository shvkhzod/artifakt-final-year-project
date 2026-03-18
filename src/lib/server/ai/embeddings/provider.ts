import { AI_CONFIG } from '../config';

export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedImage(imageUrl: string): Promise<number[]>;
  embedClip(input: string, type: 'text' | 'image'): Promise<number[]>;
  dimensions: { text: number; image: number };
}

let _provider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (_provider) return _provider;

  if (AI_CONFIG.embedding.provider === 'api') {
    const { ApiEmbeddingProvider } = await import('./api');
    _provider = new ApiEmbeddingProvider();
  } else {
    const { LocalEmbeddingProvider } = await import('./local');
    _provider = new LocalEmbeddingProvider();
  }

  return _provider;
}

export type EmbeddingType = 'text' | 'image';

export function getEmbeddingType(itemType: string): EmbeddingType {
  return (itemType === 'image' || itemType === 'screenshot') ? 'image' : 'text';
}
