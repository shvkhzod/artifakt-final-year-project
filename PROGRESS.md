# Aina — Build Progress

## Phase 1: Foundation (Complete)

### CSS Architecture
- `src/lib/styles/tokens.css` — All design tokens as CSS custom properties (surfaces, text, cluster colors, accent, borders, typography, type scale, spacing, radius, transitions)
- `src/lib/styles/reset.css` — Minimal box-sizing/margin reset
- `src/lib/styles/global.css` — Body styles, heading typography, scrollbar, selection color
- `src/lib/styles/animations.css` — Shared keyframes (fadeIn, slideUp, scaleIn, shimmer)
- `src/lib/styles/utils.css` — .visually-hidden / .sr-only only

### Layout
- `src/routes/+layout.svelte` — Imports all stylesheets in correct order, loads Google Fonts (Instrument Serif + DM Sans) with preconnect

### Shared Components (`src/lib/components/shared/`)
- **Button.svelte** — 3 variants (primary/secondary/ghost), 3 sizes, disabled state
- **SearchBar.svelte** — Dark input with SVG icon, focus glow, bindable value, Enter-to-search
- **ClusterPill.svelte** — Color-coded pills using cluster CSS vars with active state
- **Toast.svelte** — Fixed bottom-center notification, auto-dismiss, 3 types (success/error/info)
- **ImageCard.svelte** — Image card with hover scale, title overlay, cluster dot, tags
- **QuoteCard.svelte** — Quote card with large opening mark, italic font-display, left border accent
- **ArticleCard.svelte** — Article card with optional thumbnail, 2-line clamp description, source, tags
- **index.ts** — Barrel re-export of all shared components

## Phase 2: Data Layer (Complete)

### Database
- `src/lib/server/db/schema.ts` — Full Drizzle ORM schema: items (with pgvector embedding), clusters, item_clusters, tags, item_tags, insights. Custom vector(512) type. Exported inferred types.
- `src/lib/server/db/index.ts` — PostgreSQL connection via postgres.js + Drizzle
- `src/lib/server/db/queries.ts` — 13 typed query helpers: CRUD for items/clusters/tags, vector similarity search, cluster-item junction management
- `src/lib/server/db/seed.ts` — 20 sample items (6 images, 6 articles, 5 quotes, 3 screenshots), 4 clusters, 8 tags with assignments
- `drizzle.config.ts` — Drizzle Kit config pointing to schema

### API Routes
- `POST /api/items` — Create item + async embedding generation
- `GET /api/items` — List items with optional filters (limit, offset, type, clusterId)
- `GET /api/items/[id]` — Get single item (404 if missing)
- `DELETE /api/items/[id]` — Delete item (204 response)

### Configuration
- `.env.example` — DATABASE_URL + OPENROUTER_API_KEY
- package.json scripts: db:push, db:seed, db:generate, db:studio

## Phase 3: AI Pipeline (Complete)

### Types
- `src/lib/utils/types.ts` — All shared TypeScript interfaces: Item, NewItem, Cluster, Tag, Insight, EmbeddingResult, ClusterAssignment, SimilarItem, ApiResponse, PaginatedResponse, TasteMapNode, TimelineEntry

### Embedding Pipeline (`src/lib/server/ai/`)
- `embeddings.ts` — Lazy-loaded Transformers.js pipelines:
  - Text: all-MiniLM-L6-v2 (384d, padded to 512)
  - Image: CLIP ViT-B/32 (native 512d)
  - generateEmbeddingForItem() routes by item type
  - generateAndStoreEmbedding() persists to DB
- `clustering.ts` — Cosine similarity, findNearestCluster (0.3 threshold), suggestClusters (k-NN from neighbors)
- `index.ts` — Barrel re-export

## Build Status
- **Type check: 0 errors, 0 warnings**
- All 3 layers are wired together: API routes → DB queries → AI embeddings
- Ready for: UI pages (Library, Taste Map, Timeline), browser extension, D3 visualizations

## What's Next
1. Library page (masonry grid of cards)
2. Taste Map (D3 constellation visualization)
3. Taste Timeline (D3 stream graph)
4. Item detail page
5. Browser extension (Manifest V3)
6. Onboarding flow
