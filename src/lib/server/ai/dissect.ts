import { AI_CONFIG } from './config';
import { imageToBase64 } from './clustering/naming';
import { CATEGORIES_BY_TYPE } from '$lib/utils/types';
import type { Item } from '$lib/server/db/schema';

const DISSECT_MODEL = 'google/gemini-3-flash-preview';

interface RawFragment {
	category: string;
	label: string;
	content: string;
	metadata: Record<string, unknown>;
	sort_order: number;
}

export async function dissectItem(
	item: Item,
): Promise<RawFragment[]> {
	const { apiKey } = AI_CONFIG.openrouter;
	if (!apiKey) throw new Error('OpenRouter API key not configured');

	const contentType = item.type;
	const validCategories = CATEGORIES_BY_TYPE[contentType];
	if (!validCategories) throw new Error(`Unsupported item type for dissect: ${contentType}`);

	const isImageType = contentType === 'image' || contentType === 'screenshot';

	// Build message content
	const messageParts: any[] = [];

	// For images, include the image itself
	if (isImageType) {
		const imageUrl = item.url || item.thumbnailUrl;
		if (imageUrl) {
			const base64 = await imageToBase64(imageUrl);
			if (base64) {
				messageParts.push({
					type: 'image_url',
					image_url: { url: base64 },
				});
			}
		}
	}

	// Build text context
	const textParts: string[] = [];
	if (item.title) textParts.push(`Title: ${item.title}`);
	if (item.content) textParts.push(`Content: ${item.content}`);
	if (item.url) textParts.push(`URL: ${item.url}`);
	if (item.note) textParts.push(`Note: ${item.note}`);
	if (item.aiCaption) textParts.push(`AI Description: ${item.aiCaption}`);
	textParts.push(`Type: ${contentType}`);

	messageParts.push({
		type: 'text',
		text: textParts.join('\n'),
	});

	const systemPrompt = buildSystemPrompt(contentType, validCategories);

	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: DISSECT_MODEL,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: messageParts },
			],
			max_tokens: 2000,
			temperature: 0.3,
		}),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(errorData.error ?? errorData)}`);
	}

	const data = await response.json();
	const raw = data.choices?.[0]?.message?.content;
	if (!raw) throw new Error('Empty LLM response');

	return parseAndValidate(raw, validCategories);
}

function buildSystemPrompt(contentType: string, validCategories: string[]): string {
	return `Break this ${contentType} into its parts. Return a JSON array.

Each object:
- category: one of [${validCategories.map((c) => `"${c}"`).join(', ')}]
- label: 2-6 words, plain noun phrase. Name the specific thing — "Brutalist Concrete Facade" not "Architectural Style"
- content: 1 sentence, max 20 words. Say what it IS, plainly. No "this represents", no "showcasing", no "highlighting". Just describe it like you're pointing at it.
- metadata: see schemas below
- sort_order: 0 = most prominent

Metadata (only these categories need it, all others use {}):
- palette: { "colors": ["#hex1", "#hex2", ...] } (3-6 actual colors from the image)
- quote: { "excerpt": "exact text" }
- reference: { "url": "https://...", "title": "title" } (only if a real URL exists)
- entity: { "type": "person" | "tool" | "company" | "project" }

VOICE RULES — follow these strictly:
- Write like a museum label or photo caption, not a marketing deck
- NO: "creates a sense of", "evokes", "captures the essence", "adds depth", "brings together", "speaks to", "invites the viewer"
- NO: adjective stacking ("bold dynamic vibrant energetic")
- NO: interpreting meaning or projecting emotion onto things
- YES: concrete nouns, specific details, what you literally see or read
- If it's an image, describe visible objects, colors, spatial arrangement — not vibes
- If it's text, extract the actual claim or idea — not a summary of the summary

Bad: "Bold typographic choice that creates visual impact and commands attention"
Good: "Heavy sans-serif headline, white on black, fills upper third"

Bad: "Explores the intersection of nature and technology"
Good: "Circuit board pattern printed on a dried leaf"

4-10 fragments. At least 2 categories. Return ONLY the JSON array.`;
}

function parseAndValidate(raw: string, validCategories: string[]): RawFragment[] {
	// Strip markdown fences if present
	let cleaned = raw.trim();
	if (cleaned.startsWith('```')) {
		cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
	}

	let parsed: unknown[];
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		throw new Error(`Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`);
	}

	if (!Array.isArray(parsed)) {
		throw new Error('LLM response is not an array');
	}

	// Validate and filter
	const valid: RawFragment[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue;
		const f = item as Record<string, unknown>;

		if (typeof f.category !== 'string' || !validCategories.includes(f.category)) continue;
		if (typeof f.label !== 'string' || f.label.length === 0) continue;
		if (typeof f.content !== 'string' || f.content.length === 0) continue;

		valid.push({
			category: f.category,
			label: f.label.slice(0, 100),
			content: f.content.slice(0, 500),
			metadata: (typeof f.metadata === 'object' && f.metadata !== null) ? f.metadata as Record<string, unknown> : {},
			sort_order: typeof f.sort_order === 'number' ? f.sort_order : valid.length,
		});
	}

	// Enforce 4-12 range
	if (valid.length > 12) return valid.slice(0, 12);
	if (valid.length === 0) throw new Error('LLM returned no valid fragments');

	return valid;
}
