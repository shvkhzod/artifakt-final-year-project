# Aina — Build Progress

## Phase 1: Foundation (Complete)

### CSS Architecture
- `src/lib/styles/tokens.css` — All design tokens as CSS custom properties (surfaces, text, cluster colors, accent, borders, typography, type scale, spacing, radius, transitions)
- `src/lib/styles/reset.css` — Minimal box-sizing/margin reset
- `src/lib/styles/global.css` — Body styles, heading typography, scrollbar, selection color
- `src/lib/styles/animations.css` — Shared keyframes (fadeIn, slideUp, scaleIn, shimmer) + view transition choreography
- `src/lib/styles/utils.css` — .visually-hidden / .sr-only only

### Layout
- `src/routes/+layout.svelte` — Imports all stylesheets, loads Google Fonts, global keyboard shortcuts (Cmd+K search, Cmd+N quick-add), paste-to-save, directional view transitions between pages

### Shared Components (`src/lib/components/shared/`)
- **Button.svelte** — 3 variants (primary/secondary/ghost), 3 sizes, disabled state
- **SearchBar.svelte** — Dark input with SVG icon, focus glow, bindable value
- **ClusterPill.svelte** — Color-coded pills using cluster CSS vars
- **Toast.svelte** — Fixed bottom-center notification, auto-dismiss, 3 types
- **NavBar.svelte** — Fixed top nav with sliding pill indicator, mobile hamburger menu
- **SearchOverlay.svelte** — Cmd+K search with context-aware scoping, grouped results by cluster, relative dates, context pills
- **QuickAddModal.svelte** — 3-tab modal (Link/Text/Image) with drag-drop
- **ExplorationPaths.svelte** — 3-lane horizontal scroll (semantic/cluster/temporal neighbors)
- **ExplorationBreadcrumbs.svelte** — Exploration trail with backtracking
- **ImageCard.svelte**, **QuoteCard.svelte**, **ArticleCard.svelte** — Typed card components
- **index.ts** — Barrel re-export

## Phase 2: Data Layer (Complete)

### Database
- `src/lib/server/db/schema.ts` — Drizzle ORM schema: items (clip_embedding 1024d, content_embedding 1024d, search_text tsvector, embeddingStatus, aiCaption), clusters (with source 'ai'/'user'), item_clusters, tags, item_tags, insights, cluster_runs. Parameterized pgVector type factory.
- `src/lib/server/db/index.ts` — PostgreSQL connection with 2s timeout, availability caching (isDbAvailable)
- `src/lib/server/db/queries.ts` — Typed query helpers: CRUD, hybrid search (vector + keyword), KNN with cluster joins, temporal neighbors, embedding/search_text management, stripEmbeddings utility
- `src/lib/server/db/seed.ts` — 20 sample items, 4 clusters (source: 'user'), 8 tags

### API Routes
- `POST /api/items` — Create item + async AI pipeline
- `GET /api/items` — List items with filters, embeddings stripped
- `GET /api/items/[id]` — Single item, embeddings stripped
- `DELETE /api/items/[id]` — Delete item
- `GET /api/items/[id]/related` — Branching paths: semantic, cluster, temporal lanes
- `GET /api/search` — Hybrid search (semantic + keyword) with clusterId/date scoping, groupByCluster
- `GET /api/clusters` — Cluster data with item assignments
- `GET /api/timeline` — Weekly aggregated stream data
- `GET /api/items/preview` — URL metadata via Open Graph scraping

## Phase 3: AI Pipeline (Complete)

### Embedding Provider (`src/lib/server/ai/embeddings/`)
- **provider.ts** — EmbeddingProvider interface + lazy factory (swappable local/API)
- **local.ts** — Transformers.js: Jina CLIP v2 (q4 quantized, 1024d) + all-MiniLM-L6-v2 (text, 384d). Legacy — causes OOM on Node.js.
- **api.ts** — Jina Embeddings API provider (production):
  - `jina-clip-v2` for image embeddings + clustering (clip_embedding, 1024d)
  - `jina-embeddings-v3` for semantic text search (content_embedding, 1024d)
  - Auto-resizes large images (>500KB) via sharp before base64 upload
  - Both models via `api.jina.ai/v1/embeddings`, zero local memory

### Captioning (`src/lib/server/ai/captioning.ts`)
- Google Gemma 3 27B via OpenRouter for image descriptions
- Object-first prompt: lists concrete visible items (objects, text, symbols) before mood/style
- Structured format: OBJECTS → TEXT → STYLE → CONTEXT
- 600 token limit, images resized to 512px for API

### Search (`src/routes/api/search/+server.ts`)
- **Hybrid search**: semantic vector similarity + PostgreSQL full-text keyword matching
- Query embedded with `jina-embeddings-v3`, compared against `content_embedding`
- Keyword boost via `tsvector` column (`search_text`) with GIN index
- Combined score: `semantic + (keyword_rank * 2.0)` — exact keyword matches strongly boost ranking
- Threshold: 0.40 on combined score
- Supports date scoping, cluster scoping, groupByCluster

### Clustering Engine (`src/lib/server/ai/clustering/`)
- **assign.ts** — Single-item KNN assignment using clip_embedding (K=5, cosine similarity, confidence scoring)
- **recluster.ts** — Full agglomerative re-clustering via ml-hclust, user cluster protection, centroid-based naming samples, color rotation
- **naming.ts** — LLM cluster naming via OpenRouter API (multimodal vision for image clusters)

### Pipeline
- **pipeline.ts** — Orchestrator: embed (clip + content) → update search_text → assign → maybe recluster (all non-blocking, error-isolated). Skips items with <10 chars content.
- **config.ts** — Centralized AI config (models, thresholds, provider selection, Jina API key)

## Phase 4: Pages (Complete)

### Library (`src/routes/+page.svelte`)
- Masonry grid with 3 distinct card types (image/quote/article)
- Cluster filter pills (fixed, blur-backed)
- Drag-and-drop save + paste-to-save
- View transition morph: card → item detail
- Search context: groups results by cluster

### Taste Map (`src/routes/tastemap/+page.svelte`)
- Full-screen THREE.js constellation with bloom post-processing
- Organic glow textures (FBM noise), breathing animations
- OrbitControls with auto-rotate, raycasting hover/click
- Detail panel (right sidebar / mobile bottom sheet)
- Search context: scopes to focused cluster

### Timeline (`src/routes/timeline/+page.svelte`)
- D3 stream graph with wiggle offset, gradient fills, moment markers
- Activity heatmap (GitHub-style, 365 days)
- Insight cards (3-card grid, featured first)
- Activity stats (items saved, active days, streak)
- Search context: scopes to selected time range

### Item Detail (`src/routes/item/[id]/+page.svelte`)
- Type-specific hero (image/quote/article)
- Meta row with cluster pill, confidence, tags
- In-place exploration mode: click related items to drift, breadcrumb trail, URL updates via replaceState
- ExplorationPaths: 3 lanes (semantic/cluster/temporal)
- View transition morph back to Library
- Demo data fallback when DB unavailable

## Phase 5: View Transitions (Complete)

- **Library ↔ Item Detail**: Hero morph (card image/content → detail hero), bidirectional
- **Inter-page slides**: Directional slide based on nav order (forward = left, backward = right)
- **Navbar**: Fixed during transitions (view-transition-name: navbar), sliding pill indicator
- **Progressive enhancement**: no-op on unsupported browsers
- **Reduced motion**: all transitions resolve instantly

## Specs
- `docs/superpowers/specs/2026-03-18-ai-embedding-clustering-design.md`
- `docs/superpowers/specs/2026-03-18-exploration-search-design.md`
- `docs/superpowers/specs/2026-03-18-jina-api-embeddings-design.md`

## Plans
- `docs/superpowers/plans/2026-03-18-ai-embedding-clustering.md`
- `docs/superpowers/plans/2026-03-18-exploration-search.md`

## What's Next
- AI-generated insights (taste shifts, new interest detection, milestones)
- Onboarding flow
- Browser extension (Manifest V3)
- Mobile responsive polish
- Empty states
- Collections / manual boards
- Rich tagging + filtering
