import { env } from '$env/dynamic/private';

export const AI_CONFIG = {
  embedding: {
    provider: (env.EMBEDDING_PROVIDER || 'api') as 'local' | 'api',
    textModel: 'Xenova/all-MiniLM-L6-v2',
    imageModel: 'jinaai/jina-clip-v2',
  },
  jina: {
    apiKey: env.JINA_API_KEY || '',
  },
  clustering: {
    assignmentK: 5,
    assignmentThreshold: 0.65,
    reclusterInterval: 5,
    minClusterSize: 2,
    namingSampleSize: 8,
  },
  get openrouter() {
    return {
      apiKey: env.OPENROUTER_API_KEY || '',
      model: env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku',
    };
  },
};
