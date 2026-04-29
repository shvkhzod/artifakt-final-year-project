<div align="center">

# Artifakt

**A private, AI-powered curation tool that organises everything you save and reveals who you are through what inspires you.**

*Final-year dissertation project · BSc Computer Science*

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.50-FF3E00?logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![License](https://img.shields.io/badge/License-Academic-7B9E87)](#license)

</div>

---

## The Idea

We save more than we ever read. Articles pile up in tabs, screenshots gather in camera rolls, links get shared and forgotten. Existing bookmark tools treat all of this as a flat list — a graveyard of intent. The act of *saving* something is treated as the end of a transaction, when it should be the beginning of a conversation with yourself.

**Artifakt** is a curation tool that takes your saved fragments — images, articles, quotes, screenshots — and quietly organises them into a living portrait of your taste. It uses semantic AI clustering to group items not by folder or tag, but by the latent themes that connect them. It surfaces these patterns through two reflective views: a spatial **Taste Map** (a constellation of your interests in 3D space) and a temporal **Taste Timeline** (a stream graph showing how your attention has shifted over time).

> *AI as mirror, not prescription.* Artifakt never tells you what to save or what to think. It listens, organises, and reflects.

---

## What It Does

| | |
|---|---|
| **Capture from anywhere** | Drag-drop, paste, or one-shortcut quick-add. Open Graph scraping pulls metadata from any URL. |
| **Self-organising library** | Every item is embedded with Jina CLIP v2 (multimodal) and assigned to a semantic cluster via cosine-similarity KNN. |
| **Taste Map** | A 3D constellation rendered with Three.js + bloom post-processing. Each cluster glows; each item is a star. |
| **Taste Timeline** | A D3 stream graph showing the rise and fall of clusters over time, paired with a 365-day activity heatmap. |
| **Hybrid search** | Vector similarity *and* PostgreSQL full-text search, combined with weighted ranking — exact keyword matches boost semantic neighbours. |
| **Dissect** | Any saved item can be decomposed by a vision-LLM into 4–12 typed fragments — arguments, concepts, palettes, compositions, tensions — each promotable to a standalone library item. |
| **Calm by design** | No infinite scroll. No notifications. No streaks or gamification. Dark mode, plain CSS, view transitions. |

---

## How It Works

```mermaid
flowchart LR
    A[User saves item] --> B[POST /api/items]
    B --> C{Async pipeline}
    C --> D[Jina CLIP v2<br/>image embedding<br/>1024-dim]
    C --> E[Jina v3<br/>text embedding<br/>1024-dim]
    C --> F[tsvector<br/>full-text index]
    D --> G[KNN cluster<br/>assignment]
    G --> H{Cluster drift<br/>detected?}
    H -->|yes| I[Agglomerative<br/>re-clustering]
    H -->|no| J[Done]
    I --> K[LLM cluster<br/>naming]
    K --> J
```

### The AI pipeline

When an item is saved, a non-blocking server pipeline runs five stages:

1. **Embed.** Images are sent to Jina CLIP v2 (1024-d, multimodal). Text is sent to Jina Embeddings v3 (1024-d, semantic). Large images are auto-resized via `sharp` before upload.
2. **Index.** The item's title, content, and AI caption are written to a `tsvector` column with a GIN index for keyword retrieval.
3. **Assign.** A KNN search over `clip_embedding` finds the 5 nearest neighbours; the item joins their dominant cluster with a confidence score.
4. **Re-cluster (conditional).** If cluster drift exceeds a threshold, the engine runs agglomerative hierarchical clustering (`ml-hclust`) over the full library, preserving any user-created clusters.
5. **Name.** New clusters are named by an OpenRouter LLM call using centroid-based image samples for multimodal grounding.

### Hybrid search

```ts
const combinedScore = semanticSimilarity + (keywordRank * 2.0);
// threshold: 0.40
```

Pure vector search misses exact terms. Pure keyword search misses synonyms. Artifakt computes both and fuses them with a weighted sum, so searching `"red brutalist architecture"` returns concrete matches *and* unlabelled photos that share the visual signature.

### Dissect

Each item can be decomposed by Gemini Flash (via OpenRouter) into typed fragments using a content-type-aware taxonomy:

| Item type | Fragment categories |
|---|---|
| Article | arguments · concepts · entities · quotes · references · tensions |
| Image | subjects · palettes · compositions · styles · references · typography |
| Quote | themes · concepts · tensions · implications |

The prompt is anti-slop: museum-label voice, vague language banned, concrete descriptions enforced. Fragments persist with cascade-delete and an idempotent `dissected_at` timestamp. Each can be promoted to a standalone library item — triggering the full pipeline again — closing the loop between consumption and creation.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **SvelteKit** (Svelte 5 runes) | Fine-grained reactivity, SSR-by-default, view transitions API |
| Language | **TypeScript** strict | End-to-end typing from schema to UI |
| Database | **PostgreSQL** + `pgvector` | One store for relational + vector data; no separate vector DB |
| ORM | **Drizzle** | SQL-native, generates types from schema |
| Embeddings | **Jina CLIP v2** + **v3** | Multimodal + text, hosted, zero local memory footprint |
| LLM | **OpenRouter** (Gemma 3 27B, Gemini Flash) | Provider-agnostic, multimodal, cost-effective |
| Visualisation | **Three.js** + **D3.js** | 3D constellation + stream graph |
| Styling | **Plain CSS** with custom properties | No utility framework. CSS as a design tool, not a nuisance. |
| Image processing | **sharp** | Server-side resize before embedding |

---

## Architecture

```
src/
├── lib/
│   ├── components/
│   │   ├── library/        # Masonry grid, typed cards
│   │   ├── tastemap/       # Three.js constellation, detail panel
│   │   ├── timeline/       # D3 stream graph, heatmap, insights
│   │   └── shared/         # Buttons, search, modals, dissect UI
│   ├── server/
│   │   ├── db/             # Drizzle schema, queries, seed
│   │   └── ai/
│   │       ├── embeddings/ # Provider interface (local + Jina API)
│   │       ├── clustering/ # KNN assign · agglomerative recluster · LLM naming
│   │       ├── captioning.ts
│   │       ├── dissect.ts  # Multimodal item decomposition
│   │       └── pipeline.ts # Orchestrator
│   ├── stores/             # Svelte 5 runes-based state
│   └── styles/             # tokens · reset · global · animations
└── routes/
    ├── +page.svelte                # Library
    ├── tastemap/+page.svelte       # Taste Map
    ├── timeline/+page.svelte       # Taste Timeline
    ├── item/[id]/+page.svelte      # Item detail + Dissect
    └── api/                        # Items · Search · Clusters · Timeline · Dissect
```

### Database schema (essentials)

```sql
CREATE EXTENSION vector;

CREATE TABLE items (
    id              UUID PRIMARY KEY,
    type            TEXT CHECK (type IN ('image','article','quote','screenshot')),
    title           TEXT,
    content         TEXT,
    clip_embedding      VECTOR(1024),  -- multimodal
    content_embedding   VECTOR(1024),  -- semantic text
    search_text     TSVECTOR,           -- keyword index
    ai_caption      TEXT,
    dissected_at    TIMESTAMPTZ,
    color_palette   JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON items USING ivfflat (clip_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON items USING gin   (search_text);
```

Plus tables for `clusters`, `item_clusters` (with confidence), `tags`, `item_tags`, `insights`, `cluster_runs` (audit trail), and `fragments` (Dissect output).

---

## Design Language

> Calm. Quiet. Considered.

Artifakt is built on three design commitments:

1. **Calm technology.** No infinite scroll. No push notifications. No streaks. The UI rewards attention, not addiction.
2. **AI as mirror.** AI organises invisibly. It never prescribes — it reflects. The user remains the author of meaning.
3. **Plain CSS, real engineering.** No Tailwind, no CSS-in-JS, no utility soup. All design tokens live as CSS custom properties in `tokens.css`; component styles are scoped Svelte `<style>` blocks. CSS is treated as a design tool, not a build problem.

The dark palette uses Okabe-Ito cluster colours (chosen for colour-blind accessibility), Instrument Serif for display type, and DM Sans for body — paired on an 8-point spacing grid and major-third type scale.

---

## Running Locally

### Prerequisites

- Node.js 22+
- PostgreSQL 15+ with `pgvector` extension
- A [Jina AI](https://jina.ai/embeddings/) API key (free tier available)
- An [OpenRouter](https://openrouter.ai/) API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment — create a .env file with:
#    DATABASE_URL=postgresql://user:pass@localhost:5432/artifakt
#    JINA_API_KEY=...
#    OPENROUTER_API_KEY=...

# 3. Push schema + seed sample data
npm run db:push
npm run db:seed

# 4. Run dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Useful commands

| Command | Effect |
|---|---|
| `npm run dev` | Start dev server with view transitions |
| `npm run build` | Production build |
| `npm run check` | Type-check + Svelte diagnostics |
| `npm run db:push` | Sync schema to PostgreSQL |
| `npm run db:seed` | Load 20 sample items + 4 clusters |
| `npm run db:studio` | Open Drizzle Studio |

---

## What I Built and Learned

This project is the synthesis of three threads of research:

1. **Vector retrieval at scale** — implementing hybrid (semantic + lexical) search, ivfflat indexing, and the trade-off between recall, precision, and latency in a single-store Postgres setup.
2. **Unsupervised clustering with semantic stability** — agglomerative re-clustering with user-cluster protection, drift detection, and centroid-based LLM naming to keep cluster identity stable across data growth.
3. **Multimodal AI as interface, not feature** — using vision-LLMs not as chatbots, but as silent organisers and decomposers, surfacing structure rather than producing prose.

Notable engineering decisions documented inline:
- Swappable embedding provider (`EmbeddingProvider` interface) — local Transformers.js was prototyped first, then replaced with the Jina API after Node.js OOM at scale.
- Non-blocking, error-isolated AI pipeline — embedding failures never block item creation.
- View transitions API for hero-morph navigation, with progressive enhancement and `prefers-reduced-motion` respect.

---

## Roadmap

- [ ] AI-generated insights (taste shifts, milestones, palette changes)
- [ ] First-use onboarding flow
- [ ] Browser extension (Manifest V3) for one-click capture
- [ ] Mobile-responsive polish
- [ ] User-curated collections / boards
- [ ] Rich tagging + advanced filtering

---

## Acknowledgements

- **Jina AI** — multimodal embeddings infrastructure
- **OpenRouter** — unified LLM gateway (Gemma 3, Gemini Flash)
- **pgvector** — vector similarity inside PostgreSQL
- **Okabe & Ito** — colour-blind-accessible palette research
- **The SvelteKit team** — the framework that made plain CSS feel like a superpower again

---

## License

Academic use. All rights reserved by the author for the duration of dissertation assessment. Contact for permissions beyond review.

<div align="center">

*Built with care, in the dark.*

</div>
