# Real Data & Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all demo/mock data fallbacks and add single-user password authentication to gate every route.

**Architecture:** SvelteKit `hooks.server.ts` intercepts all requests, validates a signed session cookie, and redirects unauthenticated users to `/login`. Credentials come from env vars. Demo data is replaced with empty-state components that render when the DB returns no results.

**Tech Stack:** SvelteKit, Node.js `crypto` (scrypt, HMAC-SHA256), Drizzle ORM (unchanged), plain CSS

---

### Task 1: Auth Helper Module

**Files:**
- Create: `src/lib/server/auth.ts`

- [ ] **Step 1: Create the auth helper module**

```typescript
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';

const COOKIE_NAME = 'aina_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

let cachedSecret: string | null = null;

function getSecret(): string {
	if (cachedSecret) return cachedSecret;
	cachedSecret = process.env.AINA_SECRET || randomBytes(32).toString('hex');
	return cachedSecret;
}

// Fixed salt is acceptable for single-user self-hosted: there's only one password
// and the env is trusted. The scrypt+timingSafeEqual prevents timing attacks.
export function verifyPassword(submitted: string, expected: string): boolean {
	const salt = 'aina-fixed-salt';
	const submittedHash = scryptSync(submitted, salt, 64);
	const expectedHash = scryptSync(expected, salt, 64);
	return timingSafeEqual(submittedHash, expectedHash);
}

export function createSessionCookie(): string {
	const secret = getSecret();
	const payload = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');
	const signature = createHmac('sha256', secret).update(payload).digest('base64url');
	return `${payload}.${signature}`;
}

export function verifySessionCookie(cookie: string): boolean {
	const secret = getSecret();
	const parts = cookie.split('.');
	if (parts.length !== 2) return false;

	const [payload, signature] = parts;
	const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');

	if (signature.length !== expectedSig.length) return false;
	if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return false;

	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
		const age = (Date.now() - data.ts) / 1000;
		return age < COOKIE_MAX_AGE;
	} catch {
		return false;
	}
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit src/lib/server/auth.ts 2>&1 || echo "Check manually"`
If there are type errors, fix them. The key thing is the file is valid TypeScript.

---

### Task 2: Login API Endpoint

**Files:**
- Create: `src/routes/api/auth/login/+server.ts`

- [ ] **Step 1: Create the login endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyPassword, createSessionCookie, COOKIE_NAME, COOKIE_MAX_AGE } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
	// CSRF: validate Origin header
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	const { username, password } = await request.json();

	const expectedUser = process.env.AINA_USER;
	const expectedPass = process.env.AINA_PASSWORD;

	if (!expectedUser || !expectedPass) {
		return json({ error: 'Auth not configured' }, { status: 500 });
	}

	if (username !== expectedUser || !verifyPassword(password, expectedPass)) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const cookie = createSessionCookie();

	return json({ success: true }, {
		headers: {
			'Set-Cookie': `${COOKIE_NAME}=${cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}${url.protocol === 'https:' ? '; Secure' : ''}`,
		},
	});
};
```

---

### Task 3: Logout API Endpoint

**Files:**
- Create: `src/routes/api/auth/logout/+server.ts`

- [ ] **Step 1: Create the logout endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_NAME } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, url }) => {
	// CSRF: validate Origin header
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) {
		return json({ error: 'Invalid origin' }, { status: 403 });
	}

	return json({ success: true }, {
		headers: {
			'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
		},
	});
};
```

---

### Task 4: Server Hooks — Route Protection

**Files:**
- Create: `src/hooks.server.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { verifySessionCookie, COOKIE_NAME } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (isPublic(pathname)) {
		return resolve(event);
	}

	const cookie = event.cookies.get(COOKIE_NAME);
	const isAuthenticated = cookie ? verifySessionCookie(cookie) : false;

	if (!isAuthenticated) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		throw redirect(302, '/login');
	}

	return resolve(event);
};
```

---

### Task 5: Login Page

**Files:**
- Create: `src/routes/login/+page.svelte`

- [ ] **Step 1: Create the login page**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});

			if (res.ok) {
				await goto('/', { replaceState: true });
			} else {
				const data = await res.json();
				error = data.error || 'Invalid credentials';
			}
		} catch {
			error = 'Something went wrong';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login — Aina</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="login-page">
	<form class="login-card" onsubmit={handleSubmit}>
		<h1 class="login-title">Aina</h1>
		<p class="login-subtitle">Sign in to your collection</p>

		{#if error}
			<div class="login-error" role="alert">{error}</div>
		{/if}

		<label class="field">
			<span class="field-label">Username</span>
			<input
				type="text"
				bind:value={username}
				autocomplete="username"
				required
				disabled={loading}
			/>
		</label>

		<label class="field">
			<span class="field-label">Password</span>
			<input
				type="password"
				bind:value={password}
				autocomplete="current-password"
				required
				disabled={loading}
			/>
		</label>

		<button class="login-btn" type="submit" disabled={loading}>
			{loading ? 'Signing in...' : 'Sign in'}
		</button>
	</form>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: var(--bg-void, #000);
		padding: var(--space-lg, 1.5rem);
	}

	.login-card {
		width: 100%;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		gap: var(--space-md, 1rem);
	}

	.login-title {
		font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
		font-size: var(--text-3xl, 2.4375rem);
		font-weight: 400;
		color: var(--text-primary, #E8E8E8);
		text-align: center;
		margin: 0;
	}

	.login-subtitle {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		color: var(--text-tertiary, rgba(255, 255, 255, 0.30));
		text-align: center;
		margin: 0 0 var(--space-md, 1rem);
	}

	.login-error {
		font-size: var(--text-sm, 0.875rem);
		color: var(--cluster-vermillion, #D55E00);
		background: rgba(213, 94, 0, 0.08);
		border: 1px solid rgba(213, 94, 0, 0.2);
		border-radius: var(--radius-sm, 6px);
		padding: var(--space-xs, 0.5rem) var(--space-sm, 0.75rem);
		text-align: center;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-xs, 0.75rem);
		font-weight: 500;
		color: var(--text-secondary, rgba(255, 255, 255, 0.55));
		letter-spacing: 0.02em;
	}

	.field input {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-base, 1.0625rem);
		color: var(--text-primary, #E8E8E8);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-light, rgba(255, 255, 255, 0.10));
		border-radius: var(--radius-sm, 6px);
		padding: 10px 14px;
		outline: none;
		transition: border-color var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.field input:focus {
		border-color: var(--accent-sage, #7B9E87);
	}

	.field input:disabled {
		opacity: 0.5;
	}

	.login-btn {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		font-weight: 600;
		color: #fff;
		background: var(--accent-sage, #7B9E87);
		border: none;
		border-radius: var(--radius-sm, 6px);
		padding: 12px;
		cursor: pointer;
		margin-top: var(--space-xs, 0.5rem);
		transition: opacity var(--duration-fast, 150ms) var(--ease-out, ease),
			transform var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.login-btn:hover:not(:disabled) {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.login-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.login-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
```

- [ ] **Step 2: Verify the login page renders**

Run: `npm run dev`
Navigate to `http://localhost:5173/login` — should show the login form.

---

### Task 6: Logout Button in NavBar

**Files:**
- Modify: `src/lib/components/shared/NavBar.svelte`

- [ ] **Step 1: Add logout handler and button**

In the `<script>` block, add after the `closeMobileMenu` function:

```typescript
async function handleLogout() {
	await fetch('/api/auth/logout', { method: 'POST' });
	window.location.href = '/login';
}
```

Replace the `.avatar-placeholder` div (lines 84-89) with:

```svelte
<button class="nav-icon-btn" onclick={handleLogout} aria-label="Sign out" title="Sign out">
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<polyline points="16 17 21 12 16 7" />
		<line x1="21" y1="12" x2="9" y2="12" />
	</svg>
</button>
```

- [ ] **Step 2: Remove the `.avatar-placeholder` CSS rules**

Delete the `.avatar-placeholder` CSS block and the `@media (max-width: 640px)` rule that hides it.

---

### Task 7: EmptyState Component

**Files:**
- Create: `src/lib/components/shared/EmptyState.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
	let {
		heading,
		subtitle = '',
		cta,
	}: {
		heading: string;
		subtitle?: string;
		cta?: { label: string; href: string };
	} = $props();
</script>

<div class="empty-state">
	<h2 class="empty-heading">{heading}</h2>
	{#if subtitle}
		<p class="empty-subtitle">{subtitle}</p>
	{/if}
	{#if cta}
		<a href={cta.href} class="empty-cta">{cta.label}</a>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 40vh;
		text-align: center;
		padding: var(--space-3xl, 4rem) var(--space-lg, 1.5rem);
	}

	.empty-heading {
		font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
		font-size: var(--text-2xl, 1.9375rem);
		font-weight: 400;
		color: var(--text-secondary, rgba(255, 255, 255, 0.55));
		margin: 0 0 var(--space-xs, 0.5rem);
	}

	.empty-subtitle {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		color: var(--text-tertiary, rgba(255, 255, 255, 0.30));
		margin: 0;
		max-width: 32ch;
	}

	.empty-cta {
		display: inline-block;
		margin-top: var(--space-lg, 1.5rem);
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		font-weight: 500;
		color: var(--accent-sage, #7B9E87);
		text-decoration: none;
		padding: 8px 20px;
		border: 1px solid var(--accent-sage, #7B9E87);
		border-radius: var(--radius-full, 9999px);
		transition: background var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.empty-cta:hover {
		background: rgba(123, 158, 135, 0.1);
	}
</style>
```

---

### Task 8: Remove Demo Data from Library Page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Remove the demoItems array and fallback logic**

Delete lines 32-35 (the `makeCluster` function) and lines 37-59 (the entire `demoItems` array).

Replace the `gridItems` derived (lines 62-64):
```typescript
// Old:
let gridItems: GridItem[] = $derived(
	(data?.items && data.items.length > 0) ? data.items : demoItems
);
```

With:
```typescript
let gridItems: GridItem[] = $derived(data?.items ?? []);
```

- [ ] **Step 2: Add EmptyState import and rendering**

Add import at top of script:
```typescript
import EmptyState from '$lib/components/shared/EmptyState.svelte';
```

In the template, wrap the grid section. Replace the `<div class="library" ...>` block (lines 221-276) with:

```svelte
<div
	class="library"
	role="region"
	aria-label="Saved items"
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if visibleItems.length === 0}
		<EmptyState
			heading="Your collection is empty"
			subtitle="Save your first item to get started"
		/>
	{:else}
		<div class="grid">
			{#each visibleItems as item (item.id)}
				{@const isTransitioning = transitioningId === item.id}
				{@const clusterCol = item.cluster?.color || 'rgba(255,255,255,0.06)'}
				<button
					class="grid-card"
					class:card-type-image={item.type === 'image' || item.type === 'screenshot'}
					class:card-type-quote={item.type === 'quote'}
					class:card-type-article={item.type === 'article'}
					style="--cluster-col: {clusterCol}"
					onclick={() => handleItemClick(item.id)}
				>
					{#if item.type === 'image' || item.type === 'screenshot'}
						<div class="card-image" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
							<img
								src={item.url || item.thumbnailUrl}
								alt={item.title || 'Saved image'}
								loading="lazy"
								draggable="false"
							/>
							<span class="image-edge" aria-hidden="true"></span>
						</div>
						{#if item.title}
							<span class="image-caption" style={isTransitioning ? 'view-transition-name: item-title' : ''}>{item.title}</span>
						{/if}
					{:else if item.type === 'quote'}
						<div class="card-quote" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
							<p class="quote-text">{item.content}</p>
							{#if item.note}
								<span class="quote-author">{item.note}</span>
							{/if}
						</div>
					{:else if item.type === 'article'}
						<div class="card-article" style={isTransitioning ? 'view-transition-name: item-hero' : ''}>
							<h4 class="article-title" style={isTransitioning ? 'view-transition-name: item-title' : ''}>{item.title}</h4>
							{#if item.content}
								<p class="article-desc">{item.content}</p>
							{/if}
							{#if item.url}
								<span class="article-source">{extractDomain(item.url)}</span>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
```

- [ ] **Step 3: Remove the `getClusterColor` import if no longer used**

The `makeCluster` function used `getClusterColor`. After removing `makeCluster` and `demoItems`, check if `getClusterColor` is still used elsewhere in the file. If not, remove the import.

---

### Task 9: Remove Demo Data from Tastemap Page

**Files:**
- Modify: `src/routes/tastemap/+page.svelte`

- [ ] **Step 1: Remove all demo data**

Delete lines 12-101: the `demoClusters` record, the `makeItem` helper, the `MapNodeInput` interface, and the `demoNodes` array.

Remove the `CLUSTER_COLORS` import from line 6 (no longer needed after removing demo data).

- [ ] **Step 2: Replace the derived values**

Replace lines 103-107:
```typescript
// Old:
let nodes = $derived((data?.nodes && data.nodes.length > 0) ? data.nodes : demoNodes);
let clusters = $derived((data?.clusters && Object.keys(data.clusters).length > 0)
	? data.clusters
	: demoClusters);
```

With:
```typescript
let nodes = $derived(data?.nodes ?? []);
let clusters = $derived(data?.clusters ?? {});
```

- [ ] **Step 3: Add EmptyState**

Add import:
```typescript
import EmptyState from '$lib/components/shared/EmptyState.svelte';
```

In the template, wrap the content inside `.tastemap-page` with an empty-state check. Replace lines 148-171:

```svelte
<div class="tastemap-page">
	{#if nodes.length === 0}
		<EmptyState
			heading="Not enough data yet"
			subtitle="Save a few items and your taste map will emerge"
		/>
	{:else}
		<!-- Stats badge -->
		<div class="stats-badge">
			<span class="item-count">{itemCount} items · {clusterCount} clusters</span>
		</div>

		<!-- Constellation visualization -->
		<ConstellationMap
			{nodes}
			onSelectNode={handleSelectNode}
		/>

		<!-- Detail panel -->
		<DetailPanel
			item={selectedItem}
			cluster={selectedCluster}
			onClose={handleCloseDetail}
		/>

		<!-- Zoom hint (fades out) -->
		<div class="zoom-hint">
			Scroll to zoom · Drag to pan · Click a star to inspect
		</div>
	{/if}
</div>
```

---

### Task 10: Remove Demo Data from Timeline Page

**Files:**
- Modify: `src/routes/timeline/+page.svelte`

- [ ] **Step 1: Accept server loader data**

Add a data prop at the top of the script (after imports):
```typescript
let { data }: { data?: any } = $props();
```

- [ ] **Step 2: Remove all inline demo data generation**

Delete lines 29-36 (hardcoded `streams` array), lines 38-115 (the `generateStreamData`, `allData`, and `moments` arrays), lines 146-178 (`generateHeatmapData` function), and line 180 (`heatmapData` constant).

Also delete lines 227-246 (hardcoded `insights` array).

- [ ] **Step 3: Wire up to server loader data**

Replace the deleted demo data with references to server data. Note: `allData` and `heatmapData` change from plain constants to `$derived` values, so `filteredData`/`filteredMoments`/`longestStreak`/`activeDays` must also be updated to use `$derived.by` properly:

```typescript
// Wire to server loader data (these are reactive, not constants)
const streams: StreamDef[] = $derived(data?.streams ?? []);
const allData: TimeSeriesData[] = $derived(
	(data?.weeks ?? []).map((w: any) => ({ ...w, date: new Date(w.date) }))
);
const moments: MomentMarker[] = []; // Moments will come from insights API later
const heatmapData = $derived(
	(data?.heatmapData ?? []).map((d: any) => ({ date: new Date(d.date), count: d.count }))
);
const insights: any[] = []; // Will come from DB later
```

- [ ] **Step 4: Update all derived values**

Since `allData` and `heatmapData` are now `$derived`, the existing `filteredData`, `filteredMoments`, `totalItems`, `activeDays`, and `longestStreak` computations need updating. Replace them with:

```typescript
let filteredData = $derived.by(() => {
	const weekCounts: Record<TimeRange, number> = {
		'3M': 13,
		'6M': 26,
		'1Y': 52,
		ALL: allData.length,
	};
	const count = weekCounts[activeRange];
	return allData.slice(allData.length - count);
});

let filteredMoments = $derived.by(() => {
	if (filteredData.length === 0) return [];
	const startDate = filteredData[0].date as Date;
	return moments.filter((m) => m.date >= startDate);
});

let totalItems = $derived(data?.totalItems ?? 0);
let activeDays = $derived(heatmapData.filter((d: any) => d.count > 0).length);
let longestStreak = $derived.by(() => {
	let max = 0;
	let current = 0;
	for (const d of heatmapData) {
		if (d.count > 0) {
			current++;
			if (current > max) max = current;
		} else {
			current = 0;
		}
	}
	return max;
});
```

Note: `filteredData` and `filteredMoments` are now direct values (not functions), so update template references from `filteredData()` to `filteredData` and `filteredMoments()` to `filteredMoments`. Also update `longestStreak()` to `longestStreak` in the template.

- [ ] **Step 5: Add EmptyState**

Add import:
```typescript
import EmptyState from '$lib/components/shared/EmptyState.svelte';
```

Wrap `<main class="timeline-content">` content with:
```svelte
{#if streams.length === 0}
	<EmptyState
		heading="No history yet"
		subtitle="Your timeline builds as you save items over time"
	/>
{:else}
	<!-- ...existing content... -->
{/if}
```

---

### Task 11: Remove getDemoItem from Item Detail

**Files:**
- Modify: `src/routes/item/[id]/+page.server.ts`

- [ ] **Step 1: Remove demo fallback**

Remove the import on line 7:
```typescript
import { getDemoItem } from '$lib/utils/demoData';
```

Replace lines 10-14:
```typescript
// Old:
if (!(await isDbAvailable())) {
	const demo = getDemoItem(params.id);
	if (demo) return demo;
	throw error(404, 'Item not found');
}
```

With:
```typescript
if (!(await isDbAvailable())) {
	throw error(503, 'Database not available');
}
```

---

### Task 12: Delete demoData.ts

**Files:**
- Delete: `src/lib/utils/demoData.ts`

- [ ] **Step 1: Delete the file**

Run: `rm src/lib/utils/demoData.ts`

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "demoData" src/`
Expected: no results.

---

### Task 13: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add auth env vars**

Add to `.env.example`:
```
AINA_USER=admin
AINA_PASSWORD=changeme
AINA_SECRET=
```

- [ ] **Step 2: Add the same vars to your local .env**

Ensure `.env` has `AINA_USER` and `AINA_PASSWORD` set so you can test login.

---

### Task 14: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test auth flow**

1. Open `http://localhost:5173/` — should redirect to `/login`
2. Try wrong credentials — should show error
3. Log in with correct credentials — should redirect to `/`
4. Refresh — should stay logged in
5. Click logout in navbar — should return to `/login`
6. Try accessing `/api/items` without session — should get `401 JSON`

- [ ] **Step 3: Test empty states**

With an empty database (no items):
1. Library page shows "Your collection is empty"
2. Tastemap shows "Not enough data yet"
3. Timeline shows "No history yet"

- [ ] **Step 4: Test with real data**

Save an item (drag & drop, paste, or quick-add). Verify it appears in the library, and eventually in tastemap/timeline after the AI pipeline processes it.
