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
    assignmentThreshold: 0.55,
    reclusterSimilarityThreshold: 0.65,
    reclusterInterval: 5,
    minClusterSize: 2,
    minItemsForClustering: 10,
    maxClustersRatio: 3,
    namingSampleSize: 8,
  },
  get arena() {
    return {
      accessToken: env.ARENA_ACCESS_TOKEN || '',
    };
  },
  get tumblr() {
    return {
      apiKey: env.TUMBLR_API_KEY || '',
    };
  },
  get openrouter() {
    return {
      apiKey: env.OPENROUTER_API_KEY || '',
      model: env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku',
    };
  },
};
