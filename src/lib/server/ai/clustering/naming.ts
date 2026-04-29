import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { AI_CONFIG } from '../config';

const VISION_MODEL = 'google/gemma-3-27b-it';

export async function generateClusterName(
  items: Array<{ title: string | null; content: string | null; type: string; url: string | null; thumbnailUrl: string | null }>,
): Promise<string> {
  const { apiKey } = AI_CONFIG.openrouter;

  if (!apiKey) {
    return `Cluster #${Date.now().toString(36).slice(-4)}`;
  }

  const hasImages = items.some((i) => i.type === 'image' || i.type === 'screenshot');

  try {
    if (hasImages) {
      return await nameWithVision(items, apiKey);
    } else {
      return await nameWithText(items, apiKey);
    }
  } catch (e) {
    console.error('Cluster naming failed:', e);
    return `Cluster #${Date.now().toString(36).slice(-4)}`;
  }
}

async function nameWithText(
  items: Array<{ title: string | null; content: string | null; type: string }>,
  apiKey: string,
): Promise<string> {
  const { model } = AI_CONFIG.openrouter;

  const descriptions = items
    .slice(0, AI_CONFIG.clustering.namingSampleSize)
    .map((item, i) => {
      const parts = [item.type];
      if (item.title) parts.push(`"${item.title}"`);
      if (item.content) parts.push(item.content.slice(0, 100));
      return `${i + 1}. ${parts.join(' — ')}`;
    })
    .join('\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: `These saved items form a natural group:\n\n${descriptions}\n\nGive this collection a short, literal, descriptive name (2-3 words) that says what these items are about. Be specific and plain — like "Film Photography", "UI Design", "Architecture", "Street Fashion". No poetry, no metaphors, no mood words. Return only the name, nothing else.`,
      }],
      max_tokens: 20,
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || `Cluster #${Date.now().toString(36).slice(-4)}`;
}

async function nameWithVision(
  items: Array<{ title: string | null; content: string | null; type: string; url: string | null; thumbnailUrl: string | null }>,
  apiKey: string,
): Promise<string> {
  // Build multimodal content: images as base64 + text descriptions
  const contentParts: any[] = [];

  for (const item of items.slice(0, 4)) {
    const imageUrl = item.url || item.thumbnailUrl;
    if (imageUrl && (item.type === 'image' || item.type === 'screenshot')) {
      const base64 = await imageToBase64(imageUrl);
      if (base64) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: base64 },
        });
      }
    }
    // Add text context if available
    const textParts: string[] = [];
    if (item.title && !item.title.match(/\.[a-z]{3,4}$/i)) textParts.push(item.title);
    if (item.content) textParts.push(item.content.slice(0, 80));
    if (textParts.length > 0) {
      contentParts.push({ type: 'text', text: textParts.join(' — ') });
    }
  }

  // If no images could be encoded, fall back to text-only naming
  const imageCount = contentParts.filter((p) => p.type === 'image_url').length;
  console.log(`Vision naming: ${items.length} items, ${imageCount} images encoded, ${contentParts.length} total parts`);
  if (imageCount === 0) {
    console.log('No images encoded, falling back to text naming');
    return nameWithText(items, apiKey);
  }

  contentParts.push({
    type: 'text',
    text: 'These images were saved together as a collection. Based on what you see, give this collection a short, literal, descriptive name (2-3 words) that says what the subject matter is. Be specific and plain — like "Film Photography", "3D Renders", "Architecture", "Street Fashion". No poetry, no metaphors, no mood words. Return only the name, nothing else.',
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{ role: 'user', content: contentParts }],
      max_tokens: 20,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Vision naming failed:', response.status, JSON.stringify(data));
    throw new Error(`OpenRouter vision ${response.status}: ${JSON.stringify(data.error)}`);
  }
  const name = data.choices?.[0]?.message?.content?.trim();
  console.log('Vision naming result:', name);
  return name || `Cluster #${Date.now().toString(36).slice(-4)}`;
}

const MAX_IMAGE_BYTES = 500_000; // 500KB max for API

export async function imageToBase64(imageUrl: string): Promise<string | null> {
  try {
    let buffer: Buffer;

    if (imageUrl.startsWith('/uploads/')) {
      const filePath = resolve('static', imageUrl.slice(1));
      buffer = await readFile(filePath);
    } else if (imageUrl.startsWith('http')) {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }

    // Skip SVGs and very small files
    const mime = detectMime(buffer);
    if (mime === 'image/svg+xml') return null;

    // If image is too large, resize it using sharp if available, otherwise skip
    if (buffer.length > MAX_IMAGE_BYTES) {
      try {
        const sharp = (await import('sharp')).default;
        buffer = await sharp(buffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
      } catch {
        // sharp not available — just skip oversized images
        console.warn(`Image too large (${(buffer.length / 1024).toFixed(0)}KB), skipping:`, imageUrl);
        return null;
      }
    }

    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to read image:', imageUrl, e);
    return null;
  }
}

function detectMime(buffer: Buffer): string {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
  // SVG starts with < (0x3C)
  if (buffer[0] === 0x3C) return 'image/svg+xml';
  return 'image/jpeg';
}
