## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# Aina — AI-Powered Personal Curation App

## What This Is
Aina is a private, AI-powered curation tool that organizes everything you save
and reveals who you are through what inspires you. It saves content from anywhere,
auto-organizes via semantic AI clustering, and provides self-reflection through a
Taste Map (spatial constellation visualization) and Taste Timeline (temporal evolution).

## Tech Stack
- Frontend: SvelteKit  + TypeScript
- Styling: Plain CSS — scoped component styles + global design tokens via CSS custom properties. NO TAILWIND. NO UTILITY CLASSES.
- Database: PostgreSQL (via Supabase, or local pg for dev)
- ORM/Query: Drizzle ORM with PostgreSQL driver
- Vector Storage: pgvector extension in PostgreSQL
- Embeddings: Transformers.js (CLIP for images, all-MiniLM-L6-v2 for text)
- LLM: OpenRouter API 
- Visualization: D3.js for Taste Map and Timeline
- Browser Extension: Manifest V3, built from SvelteKit
- Deployment: Vercel (web app), Chrome Web Store (extension)

## Architecture Principles

- LOCAL-FIRST MENTALITY: User data belongs to the user. PostgreSQL stores everything but export is always available. No vendor lock-in.
- CALM TECHNOLOGY: No infinite scroll, no push notifications, no gamification.
- AI AS MIRROR: AI organizes invisibly and reflects patterns back — never prescriptive.
- PLAIN CSS: We write real CSS. Scoped styles in .svelte files. Global design tokens in src/lib/styles/tokens.css. No utility frameworks, no CSS-in-JS. CSS is a design tool, not a nuisance.

## CSS Architecture

src/lib/styles/
├── tokens.css      # CSS custom properties (colors, fonts, spacing, radii)
├── reset.css       # Minimal reset (box-sizing, margin reset)
├── global.css      # Global typography, body styles, scrollbar styling
├── animations.css  # Shared keyframe animations and transitions
└── utils.css       # Only truly reusable classes (.visually-hidden, .sr-only)

All component-specific styles live in `<style>` blocks inside .svelte files.
Import order in +layout.svelte: reset → tokens → global → animations → utils.

### Design Tokens (defined in tokens.css as CSS custom properties)
```css
:root {
  /* Surfaces */
  --bg-void: #000000;
  --bg-surface-1: #0f0f10;
  --bg-surface-2: #0e0e0f;
  --bg-surface-3: #0f0f10;
  --bg-warm: #1E1D20;

  /* Text */
  --text-primary: #E8E8E8;
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-tertiary: rgba(255, 255, 255, 0.30);
  --text-ghost: rgba(255, 255, 255, 0.15);

  /* Cluster Colors (Okabe-Ito) */
  --cluster-amber: #E69F00;
  --cluster-cyan: #56B4E9;
  --cluster-emerald: #009E73;
  --cluster-blue: #0072B2;
  --cluster-vermillion: #D55E00;
  --cluster-mauve: #CC79A7;

  /* Accent */
  --accent-sage: #7B9E87;

  /* Border */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-light: rgba(255, 255, 255, 0.10);

  /* Typography */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, sans-serif;

  /* Type Scale (Major Third 1.25) */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1.0625rem; /* 17px */
  --text-lg: 1.25rem;    /* 20px */
  --text-xl: 1.5625rem;  /* 25px */
  --text-2xl: 1.9375rem; /* 31px */
  --text-3xl: 2.4375rem; /* 39px */

  /* Spacing (8pt grid) */
  --space-xs: 0.5rem;    /* 8px */
  --space-sm: 0.75rem;   /* 12px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  --space-3xl: 4rem;     /* 64px */

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Transitions */
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}
```

## File Structure

src/
├── lib/
│   ├── components/
│   │   ├── library/    # Library canvas components
│   │   ├── tastemap/   # Taste Map constellation
│   │   ├── timeline/   # Taste Timeline stream graph
│   │   ├── extension/  # Browser extension popup
│   │   └── shared/     # Button, Card, SearchBar, ClusterPill, Toast
│   ├── stores/         # Svelte stores (state management)
│   ├── server/
│   │   ├── db/         # Drizzle schema, migrations, queries
│   │   └── ai/         # Embedding pipeline, clustering, insights
│   ├── utils/          # Helpers, constants, types
│   └── styles/         # Global CSS (tokens, reset, global, animations)
├── routes/
│   ├── +layout.svelte         # Root layout (dark mode, font loading)
│   ├── +page.svelte           # Library (home)
│   ├── tastemap/+page.svelte  # Taste Map
│   ├── timeline/+page.svelte  # Taste Timeline
│   ├── item/[id]/+page.svelte # Item detail
│   ├── onboarding/            # First-use flow
│   └── api/                   # API routes
├── extension/                  # Browser extension source
└── static/

## Database (PostgreSQL + pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT,
  title TEXT,
  content TEXT,
  type TEXT CHECK (type IN ('image', 'article', 'quote', 'screenshot')),
  thumbnail_url TEXT,
  note TEXT,
  embedding vector(512),
  color_palette JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  item_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE item_clusters (
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (item_id, cluster_id)
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  source TEXT CHECK (source IN ('ai', 'user')) DEFAULT 'ai'
);

CREATE TABLE item_tags (
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('new_interest', 'taste_shift', 'palette_change', 'milestone')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  cluster_id UUID REFERENCES clusters(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity search index
CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Code Style

- Svelte 5 runes syntax ($state, $derived, $effect)
- Prefer $lib imports
- Components: PascalCase.svelte
- Stores: camelCase.ts
- Plain CSS in <style> blocks — scoped by default in Svelte
- Global styles only in src/lib/styles/
- NEVER use utility class frameworks
- All database access through Drizzle ORM typed queries
- Server-side logic in +page.server.ts or +server.ts
- Tests: Vitest for unit, Playwright for e2e

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run test` — run tests
- `npm run db:push` — push schema to PostgreSQL
- `npm run db:seed` — seed sample data