# Aina — Content Input System

## Every Way Content Gets In

### 1. Paste Anywhere (Primary Desktop Input)

The library canvas listens for `paste` events globally. When a user pastes, the app detects content type and creates an item automatically.

```
User pastes a URL → app fetches metadata → creates article/link item
User pastes an image (from clipboard) → app uploads image → creates image item
User pastes plain text → app creates a quote item
User pastes HTML (from a webpage copy) → app extracts text + source URL → creates article item
```

**Technical flow:**

```
window.addEventListener('paste') in +layout.svelte
  ↓
Check clipboard contents:
  - clipboardData.types includes 'text/uri-list' or text looks like URL → URL flow
  - clipboardData.types includes 'image/png' or 'image/jpeg' → Image flow
  - clipboardData.types includes 'text/html' → HTML extraction flow
  - clipboardData.types includes 'text/plain' (not URL) → Quote flow
  ↓
POST /api/items with detected type + content
  ↓
Server processes:
  - URL items: fetch page with open-graph-scraper → extract title, description, OG image, favicon
  - Image items: store image (Supabase Storage or local), generate thumbnail
  - Quote items: store text directly
  ↓
Trigger embedding generation (async, non-blocking)
  ↓
Return item to client → item appears on canvas with a subtle fade-in animation
  ↓
Show toast: "Saved — Architecture" (with AI-detected cluster tag)
```

**SvelteKit implementation:**

```typescript
// src/routes/+layout.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { saveItem } from '$lib/stores/items';
  import { toast } from '$lib/stores/toast';

  onMount(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Check for images first
      const imageFile = Array.from(clipboardData.files).find(f => f.type.startsWith('image/'));
      if (imageFile) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('type', 'image');
        const item = await saveItem(formData);
        toast.show(`Saved — ${item.cluster || 'Processing...'}`);
        return;
      }

      // Check for URLs
      const text = clipboardData.getData('text/plain').trim();
      if (text && isURL(text)) {
        e.preventDefault();
        const item = await saveItem({ url: text, type: 'article' });
        toast.show(`Saved — ${item.title || 'Fetching...'}`);
        return;
      }

      // Check for HTML (copied from a webpage)
      const html = clipboardData.getData('text/html');
      if (html && text) {
        e.preventDefault();
        const item = await saveItem({ content: text, html, type: 'quote' });
        toast.show(`Saved — ${item.cluster || 'Processing...'}`);
        return;
      }

      // Plain text → quote
      if (text && text.length > 0) {
        e.preventDefault();
        const item = await saveItem({ content: text, type: 'quote' });
        toast.show(`Saved — quote`);
        return;
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  });
</script>
```

### 2. Drag and Drop

The library canvas acts as a drop zone. Users can drag:
- Image files from Finder/Explorer
- Images dragged from another browser tab
- URLs dragged from the browser address bar
- Text files

```
// src/lib/components/library/LibraryCanvas.svelte

<div
  class="library-canvas"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  class:drag-active={isDragging}
>
  <!-- library content -->

  {#if isDragging}
    <div class="drop-overlay">
      <div class="drop-message">
        <span class="drop-icon">+</span>
        <span>Drop to save</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .drop-overlay {
    position: fixed;
    inset: 0;
    background: rgba(14, 14, 16, 0.85);
    display: grid;
    place-items: center;
    z-index: 100;
    backdrop-filter: blur(8px);
  }

  .drop-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: var(--text-2xl);
  }

  .drop-icon {
    width: 64px;
    height: 64px;
    border: 2px dashed var(--border-light);
    border-radius: var(--radius-md);
    display: grid;
    place-items: center;
    font-size: var(--text-xl);
    color: var(--text-secondary);
  }

  .library-canvas.drag-active {
    /* Subtle pulse on the canvas border */
  }
</style>
```

**Drop handler:**

```typescript
async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging = false;

  const dataTransfer = e.dataTransfer;
  if (!dataTransfer) return;

  // Files (images, etc.)
  if (dataTransfer.files.length > 0) {
    for (const file of dataTransfer.files) {
      if (file.type.startsWith('image/')) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('type', 'image');
        await saveItem(formData);
      }
    }
    return;
  }

  // URL dragged from address bar or link
  const url = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
  if (url && isURL(url.trim())) {
    await saveItem({ url: url.trim(), type: 'article' });
    return;
  }

  // Plain text dragged from another app
  const text = dataTransfer.getData('text/plain');
  if (text) {
    await saveItem({ content: text, type: 'quote' });
  }
}
```

### 3. Quick-Add Modal (+ Button)

The floating "+" button opens a minimal modal with three input modes.

```
+----------------------------------------------+
|  Save something                          ✕   |
|                                              |
|  [Link]  [Text]  [Image]      ← tab strip   |
|                                              |
|  ┌──────────────────────────────────────┐    |
|  │ Paste a URL...                       │    |
|  └──────────────────────────────────────┘    |
|                                              |
|                              [ Save ]        |
+----------------------------------------------+
```

**Link tab:** Single URL input. On paste, immediately starts fetching metadata in background. Shows a preview (title, image, source) before saving.

**Text tab:** Text area for typing or pasting a quote. Optional attribution field below.

**Image tab:** Drag zone + file picker button. Shows thumbnail preview before saving.

```
// src/lib/components/shared/QuickAddModal.svelte

<dialog class="quick-add" bind:this={dialogEl}>
  <div class="quick-add__header">
    <h2>Save something</h2>
    <button class="quick-add__close" on:click={close}>✕</button>
  </div>

  <div class="quick-add__tabs">
    <button
      class="tab"
      class:tab--active={activeTab === 'link'}
      on:click={() => activeTab = 'link'}
    >Link</button>
    <button
      class="tab"
      class:tab--active={activeTab === 'text'}
      on:click={() => activeTab = 'text'}
    >Text</button>
    <button
      class="tab"
      class:tab--active={activeTab === 'image'}
      on:click={() => activeTab = 'image'}
    >Image</button>
  </div>

  {#if activeTab === 'link'}
    <div class="quick-add__body">
      <input
        type="url"
        class="input-url"
        placeholder="Paste a URL..."
        bind:value={urlInput}
        on:paste={handleUrlPaste}
        autofocus
      />
      {#if urlPreview}
        <div class="url-preview">
          {#if urlPreview.image}
            <img src={urlPreview.image} alt="" class="url-preview__image" />
          {/if}
          <div class="url-preview__meta">
            <p class="url-preview__title">{urlPreview.title}</p>
            <p class="url-preview__source">{urlPreview.source}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'text'}
    <div class="quick-add__body">
      <textarea
        class="input-text"
        placeholder="Type or paste a quote, thought, or note..."
        bind:value={textInput}
        rows="4"
      ></textarea>
      <input
        type="text"
        class="input-attribution"
        placeholder="— Attribution (optional)"
        bind:value={attribution}
      />
    </div>
  {/if}

  {#if activeTab === 'image'}
    <div class="quick-add__body">
      <div
        class="image-dropzone"
        class:image-dropzone--has-file={imageFile}
        on:drop={handleImageDrop}
        on:dragover|preventDefault
      >
        {#if imagePreview}
          <img src={imagePreview} alt="Preview" class="image-dropzone__preview" />
        {:else}
          <p>Drop an image here or <button class="link" on:click={openFilePicker}>browse</button></p>
        {/if}
      </div>
      <input type="file" accept="image/*" bind:this={fileInput} on:change={handleFileSelect} hidden />
    </div>
  {/if}

  <div class="quick-add__footer">
    <button class="save-btn" on:click={save} disabled={!canSave}>Save</button>
  </div>
</dialog>
```

### 4. API Endpoint (serves all input methods)

All input methods hit the same endpoint:

```typescript
// src/routes/api/items/+server.ts
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { fetchUrlMetadata } from '$lib/server/metadata';
import { generateEmbedding } from '$lib/server/ai/embeddings';
import { uploadImage } from '$lib/server/storage';
import { z } from 'zod';

const itemSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  type: z.enum(['image', 'article', 'quote', 'screenshot']),
  note: z.string().optional(),
});

export async function POST({ request }) {
  const contentType = request.headers.get('content-type') || '';

  let itemData;

  // Handle multipart (image uploads from paste/drop/file picker)
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const type = formData.get('type') as string;

    if (!imageFile) throw error(400, 'No image provided');

    // Upload image, get URL back
    const imageUrl = await uploadImage(imageFile);

    itemData = {
      type: type || 'image',
      thumbnail_url: imageUrl,
      title: imageFile.name,
    };
  } else {
    // Handle JSON (URLs, text, quotes)
    const body = await request.json();
    const parsed = itemSchema.parse(body);

    // If URL provided, fetch metadata
    if (parsed.url) {
      const metadata = await fetchUrlMetadata(parsed.url);
      itemData = {
        url: parsed.url,
        title: metadata.title || parsed.title,
        content: metadata.description,
        thumbnail_url: metadata.image,
        type: parsed.type || 'article',
      };
    } else {
      itemData = {
        content: parsed.content,
        title: parsed.title,
        type: parsed.type || 'quote',
        note: parsed.note,
      };
    }
  }

  // Insert into database
  const [newItem] = await db.insert(items).values(itemData).returning();

  // Generate embedding async (don't block the response)
  generateEmbedding(newItem.id).catch(console.error);

  return json(newItem, { status: 201 });
}
```

### 5. URL Metadata Fetching

```typescript
// src/lib/server/metadata.ts
import ogs from 'open-graph-scraper';

export async function fetchUrlMetadata(url: string) {
  try {
    const { result } = await ogs({ url, timeout: 5000 });

    return {
      title: result.ogTitle || result.dcTitle || '',
      description: result.ogDescription || result.dcDescription || '',
      image: result.ogImage?.[0]?.url || '',
      favicon: result.favicon || '',
      siteName: result.ogSiteName || new URL(url).hostname,
    };
  } catch {
    // Fallback: extract domain at minimum
    return {
      title: '',
      description: '',
      image: '',
      favicon: '',
      siteName: new URL(url).hostname,
    };
  }
}
```

### 6. Keyboard Shortcut

Global keyboard shortcut to open Quick-Add:

```typescript
// In +layout.svelte
function handleKeydown(e: KeyboardEvent) {
  // Cmd+K or Ctrl+K → open search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }

  // Cmd+N or Ctrl+N → open quick-add
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    openQuickAdd();
  }
}
```

---

## Summary: Input Method Priority

| Method | Context | Friction Level |
|--------|---------|----------------|
| Browser extension | Browsing the web | 1 click |
| Cmd+V paste on canvas | In the app, content in clipboard | 1 keystroke |
| Drag and drop | File from desktop / image from browser | 1 gesture |
| Quick-add modal (+) | In the app, no content ready | 3-4 clicks |
| Cmd+N shortcut | In the app, keyboard user | 1 keystroke + typing |
| API endpoint | Programmatic / other integrations | N/A |

The design principle: **the fastest input is no UI at all** — just paste or drop. The Quick-Add modal exists for when you don't have content in your clipboard and need to type something manually or upload a file.

---

## Claude Code Agent Prompt to Build This

```
Use the engineer agent to build the complete content input system for Aina.

This includes:

1. Global paste handler in +layout.svelte that detects URLs, images, HTML, and plain text
   from clipboard and auto-saves with the correct type

2. Drag-and-drop handler on the library canvas with a frosted-glass drop overlay
   that accepts image files, dragged URLs, and dragged text

3. Quick-Add modal component (QuickAddModal.svelte) with three tabs:
   Link (URL input with live metadata preview), Text (textarea + attribution),
   Image (drop zone + file picker with preview)

4. POST /api/items endpoint that handles both multipart/form-data (image uploads)
   and JSON (URLs, text) with zod validation

5. URL metadata fetcher using open-graph-scraper (title, description, OG image, favicon)

6. Image upload handler (to Supabase Storage or local /static/uploads for dev)

7. Keyboard shortcuts: Cmd+N for quick-add, Cmd+K for search

8. Toast notification on successful save showing the item title and AI-detected cluster

All input methods converge on the same API endpoint. Embedding generation triggers
async after save (non-blocking). Everything uses plain CSS with design tokens.

Then use the designer agent to style the QuickAddModal and drop overlay
with the Aina dark-mode aesthetic.
```