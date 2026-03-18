# Jina Embeddings API Migration

**Date**: 2026-03-18
**Status**: Approved

## Problem

Local Transformers.js loads Jina CLIP v2 (~1.5GB) into Node.js heap, causing OOM crashes during dev and production. The server dies on first embedding request.

## Solution

Replace `ApiEmbeddingProvider` stub with a working implementation that calls Jina's cloud API (`api.jina.ai/v1/embeddings`) using the same `jina-clip-v2` model. Same vectors, zero local memory.

## Design

### API Provider (`src/lib/server/ai/embeddings/api.ts`)

Implements the existing `EmbeddingProvider` interface:

- **Model**: `jina-clip-v2` (1024D vectors for both text and image)
- **Endpoint**: `POST https://api.jina.ai/v1/embeddings`
- **Auth**: `Authorization: Bearer ${JINA_API_KEY}`

**Text embedding**:
```json
{ "model": "jina-clip-v2", "input": [{ "text": "..." }] }
```

**Image embedding** (URL):
```json
{ "model": "jina-clip-v2", "input": [{ "url": "https://..." }] }
```

**Image embedding** (local file at `/uploads/...`):
- Read file from `static/uploads/`, convert to base64 data URI
- Send as: `{ "model": "jina-clip-v2", "input": [{ "image": "data:image/jpeg;base64,..." }] }`

**Response shape**:
```json
{ "data": [{ "embedding": [0.1, 0.2, ...], "index": 0 }] }
```

### `embedClip(input, type)` logic:
- `type === 'text'` → wrap in `{ text: input }`
- `type === 'image'` → if starts with `/uploads/`, read + base64; otherwise `{ url: input }`

### `embedText(text)` and `embedImage(url)`:
- Both delegate to `embedClip` since Jina CLIP v2 handles both modalities in one model.

### Config changes (`src/lib/server/ai/config.ts`)

- Add `jina.apiKey` from `env.JINA_API_KEY`
- Dimensions: both text and image → 1024

### Env changes

- Add `JINA_API_KEY` to `.env.example`
- Set `EMBEDDING_PROVIDER=api` as default (was `local`)

## What doesn't change

- Pipeline (`pipeline.ts`) — already uses `provider.embedClip()`, no changes needed
- Clustering — same 1024D vectors, same cosine similarity
- Search queries — same vector columns, same dimensions
- Database schema — `clip_embedding` and `content_embedding` columns unchanged
- Captioning — still uses OpenRouter, unrelated to embeddings

## Error handling

- API errors: throw with status code + message from Jina response
- Missing API key: throw clear error at provider construction time
- Network failures: let the pipeline's existing try/catch handle it (sets `embeddingStatus = 'failed'`)
