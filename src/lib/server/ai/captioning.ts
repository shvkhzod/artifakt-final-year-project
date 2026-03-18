import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { AI_CONFIG } from './config';

const CAPTION_MODEL = 'google/gemma-3-27b-it';

export async function generateCaption(imageUrl: string): Promise<string | null> {
  const { apiKey } = AI_CONFIG.openrouter;
  if (!apiKey) return null;

  try {
    const base64 = await imageToBase64(imageUrl);
    if (!base64) return null;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CAPTION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64 } },
            {
              type: 'text',
              text: `List every concrete object, item, animal, person, food, plant, color, text, symbol, and recognizable thing visible in this image. Be literal and specific — name what you SEE, not what it means. If there are multiple distinct scenes or panels in the image, describe each one separately. Start with a literal inventory of objects, then add mood and style after.

Format:
OBJECTS: [list every visible thing]
TEXT: [any visible text or words in the image]
STYLE: [artistic style, mood, colors]
CONTEXT: [what the image is about overall]`,
            },
          ],
        }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Caption generation failed:', response.status);
      return null;
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim();
    if (caption) {
      console.log(`Generated caption (${caption.length} chars): ${caption.slice(0, 80)}...`);
    }
    return caption || null;
  } catch (e) {
    console.error('Caption generation error:', e);
    return null;
  }
}

async function imageToBase64(imageUrl: string): Promise<string | null> {
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

    // Detect mime and skip SVGs
    const first = buffer[0];
    if (first === 0x3C) return null; // SVG
    const mime = first === 0xFF ? 'image/jpeg' : first === 0x89 ? 'image/png' : 'image/jpeg';

    // Resize if too large
    if (buffer.length > 500_000) {
      try {
        const sharp = (await import('sharp')).default;
        buffer = await sharp(buffer)
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
      } catch {
        return null;
      }
    }

    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
