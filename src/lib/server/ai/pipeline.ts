import { getEmbeddingProvider, getEmbeddingType } from './embeddings/provider';
import { generateCaption } from './captioning';
import { assignItemToCluster } from './clustering/assign';
import { shouldRecluster, runRecluster } from './clustering/recluster';
import { updateItemEmbedding, updateClipEmbedding, updateContentEmbedding, updateSearchText, setEmbeddingStatus } from '$lib/server/db/queries';

export async function processItemPipeline(
  itemId: string,
  item: {
    type: string;
    title?: string | null;
    content?: string | null;
    url?: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<void> {
  const embeddingType = getEmbeddingType(item.type);
  const provider = await getEmbeddingProvider();

  let clipEmbedding: number[];

  try {
    if (embeddingType === 'image') {
      const imageUrl = item.url || item.thumbnailUrl;
      if (!imageUrl) {
        console.warn(`Item ${itemId}: no image URL, skipping`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }

      // 1. Visual embedding (Jina CLIP v2 image mode)
      clipEmbedding = await provider.embedClip(imageUrl, 'image');
      await updateClipEmbedding(itemId, clipEmbedding);
      console.log(`Visual embedding for ${itemId} (${clipEmbedding.length}d)`);

      // 2. AI caption + content embedding (using text model for semantic search)
      const caption = await generateCaption(imageUrl);
      if (caption) {
        const contentEmbedding = await provider.embedText(caption);
        await updateContentEmbedding(itemId, contentEmbedding, caption);
        console.log(`Content embedding for ${itemId} from caption (${contentEmbedding.length}d)`);
      }
    } else {
      // Text items: embed content via Jina CLIP text mode
      const parts: string[] = [];
      if (item.title) parts.push(item.title);
      if (item.content) parts.push(item.content);
      const text = parts.join('. ').trim();

      if (text.length < 10) {
        console.warn(`Item ${itemId}: content too short ("${text}"), skipping`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }

      clipEmbedding = await provider.embedClip(text, 'text');
      await updateClipEmbedding(itemId, clipEmbedding);

      // Content embedding uses dedicated text model for better semantic search
      const contentEmbedding = await provider.embedText(text);
      await updateContentEmbedding(itemId, contentEmbedding, text);
      console.log(`Text embedding for ${itemId} (clip: ${clipEmbedding.length}d, content: ${contentEmbedding.length}d)`);
    }

    await updateSearchText(itemId);
    await setEmbeddingStatus(itemId, 'complete');
  } catch (e) {
    console.error(`Embedding failed for item ${itemId}:`, e);
    await setEmbeddingStatus(itemId, 'failed');
    return;
  }

  // Cluster assignment uses clip_embedding (visual similarity for clustering)
  try {
    const result = await assignItemToCluster(itemId, clipEmbedding);
    if (result) {
      console.log(`Assigned item ${itemId} → ${result.clusterId} (${(result.confidence * 100).toFixed(0)}%)`);
    }
  } catch (e) {
    console.error(`Cluster assignment failed for item ${itemId}:`, e);
  }

  try {
    if (await shouldRecluster()) {
      console.log('Triggering automatic re-clustering...');
      await runRecluster('auto');
    }
  } catch (e) {
    console.error('Auto re-cluster failed:', e);
  }
}
