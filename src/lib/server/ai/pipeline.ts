import { getEmbeddingProvider, getEmbeddingType } from './embeddings/provider';
import { generateCaption } from './captioning';
import { assignItemToCluster } from './clustering/assign';
import { shouldRecluster, runRecluster } from './clustering/recluster';
import { updateItemEmbedding, updateClipEmbedding, updateContentEmbedding, updateSearchText, setEmbeddingStatus } from '$lib/server/db/queries';
import { extractYouTubeId, youtubeThumbnailUrl } from '$lib/utils/youtube';

/**
 * Strip structured format labels, markdown, and preamble from AI captions
 * so the embedding captures actual content, not shared format structure.
 */
export function cleanCaptionForEmbedding(caption: string): string {
  return caption
    .split('\n')
    // Kill preamble lines like "Okay, here's a detailed breakdown..."
    .filter(line => !line.match(/^(okay|here['']?s)\b.*\b(breakdown|format|requested|description)/i))
    // Strip markdown bold/italic markers
    .map(line => line.replace(/\*+/g, '').trim())
    // Strip section headers: "OBJECTS:", "STYLE:", etc.
    .filter(line => !line.match(/^(OBJECTS|TEXT|STYLE|CONTEXT|SETTING|MOOD|COMPOSITION|DETAILS?)\s*:?\s*$/i))
    // Strip label prefix if on same line as content: "OBJECTS: car, tree" → "car, tree"
    .map(line => line.replace(/^(OBJECTS|TEXT|STYLE|CONTEXT|SETTING|MOOD|COMPOSITION|DETAILS?)\s*:\s*/i, '').trim())
    // Strip bullet markers
    .map(line => line.replace(/^[-•]\s+/, '').trim())
    .filter(line => line.length > 0)
    .join('. ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

export async function processItemPipeline(
  itemId: string,
  item: {
    type: string;
    title?: string | null;
    content?: string | null;
    note?: string | null;
    url?: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<void> {
  const embeddingType = getEmbeddingType(item.type);
  const provider = await getEmbeddingProvider();

  let contentEmbedding: number[] | null = null;

  try {
    if (item.type === 'video') {
      // Video: CLIP embed from thumbnail + content embed from title/description
      const parts: string[] = [];
      if (item.title) parts.push(item.title);
      if (item.content) parts.push(item.content);
      const text = parts.join('. ').trim();

      if (text.length < 10) {
        console.warn(`Item ${itemId}: video metadata too short ("${text}"), skipping`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }

      // CLIP embedding from thumbnail image (for visual search)
      const videoId = item.url ? extractYouTubeId(item.url) : null;
      const thumbUrl = item.thumbnailUrl || (videoId ? youtubeThumbnailUrl(videoId) : null);
      if (thumbUrl) {
        try {
          const clipEmbedding = await provider.embedClip(thumbUrl, 'image');
          await updateClipEmbedding(itemId, clipEmbedding);
          console.log(`Video CLIP embedding for ${itemId} from thumbnail (${clipEmbedding.length}d)`);
        } catch (e) {
          console.warn(`Video CLIP embedding failed for ${itemId}, falling back to text CLIP:`, e);
          const clipEmbedding = await provider.embedClip(text, 'text');
          await updateClipEmbedding(itemId, clipEmbedding);
        }
      } else {
        const clipEmbedding = await provider.embedClip(text, 'text');
        await updateClipEmbedding(itemId, clipEmbedding);
      }

      // Content embedding from title + description (for clustering/semantic search)
      contentEmbedding = await provider.embedText(text);
      await updateContentEmbedding(itemId, contentEmbedding, text);
      console.log(`Video content embedding for ${itemId} (${contentEmbedding.length}d)`);
    } else if (embeddingType === 'image') {
      const imageUrl = item.url || item.thumbnailUrl;
      if (!imageUrl) {
        console.warn(`Item ${itemId}: no image URL, skipping`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }

      // 1. Visual embedding (Jina CLIP v2 image mode) — kept for visual search
      const clipEmbedding = await provider.embedClip(imageUrl, 'image');
      await updateClipEmbedding(itemId, clipEmbedding);
      console.log(`Visual embedding for ${itemId} (${clipEmbedding.length}d)`);

      // 2. AI caption + content embedding (used for clustering and semantic search)
      const caption = await generateCaption(imageUrl);
      if (caption) {
        const cleaned = cleanCaptionForEmbedding(caption);
        contentEmbedding = await provider.embedText(cleaned);
        await updateContentEmbedding(itemId, contentEmbedding, caption);
        console.log(`Content embedding for ${itemId} from cleaned caption (${contentEmbedding.length}d)`);
      }
    } else {
      // Text items: embed content via Jina CLIP text mode
      const parts: string[] = [];
      if (item.title) parts.push(item.title);
      if (item.content) parts.push(item.content);
      if (item.note) parts.push(item.note);
      const text = parts.join('. ').trim();

      if (text.length < 10) {
        console.warn(`Item ${itemId}: content too short ("${text}"), skipping`);
        await setEmbeddingStatus(itemId, 'failed');
        return;
      }

      const clipEmbedding = await provider.embedClip(text, 'text');
      await updateClipEmbedding(itemId, clipEmbedding);

      // Content embedding used for clustering and semantic search
      contentEmbedding = await provider.embedText(text);
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

  // Cluster assignment uses content_embedding (semantic meaning, not visual similarity)
  if (contentEmbedding) {
    try {
      const result = await assignItemToCluster(itemId, contentEmbedding);
      if (result) {
        console.log(`Assigned item ${itemId} → ${result.clusterId} (${(result.confidence * 100).toFixed(0)}%)`);
      } else {
        console.log(`Item ${itemId} left uncategorized (no confident cluster match)`);
      }
    } catch (e) {
      console.error(`Cluster assignment failed for item ${itemId}:`, e);
    }
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
