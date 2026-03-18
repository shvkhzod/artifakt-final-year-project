# Real Data & Authentication Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Remove demo/mock data fallbacks, add single-user authentication

---

## Goal

Transition Aina from a demo-friendly development state to a production-ready single-user app:
1. Remove all hardcoded demo data — pages show empty states when no real data exists
2. Add simple username/password authentication gating all routes

## Constraints

- Single-user, self-hosted deployment
- No users table — credentials stored as environment variables
- No external auth providers — pure SvelteKit + crypto
- Zero new dependencies — use Node.js built-in `crypto.scrypt` for password hashing
- Preserve existing DB infrastructure and AI pipeline untouched

---

## 1. Authentication

### 1.1 Credentials

Stored as environment variables:

```
AINA_USER=your_username
AINA_PASSWORD=your_password_here
AINA_SECRET=random_secret_for_cookie_signing
```

- `AINA_USER`: plaintext username for login comparison
- `AINA_PASSWORD`: plaintext password in env var. At login, the server hashes the submitted password with `crypto.scrypt` and compares against a scrypt hash of the env var value. Plaintext in env is acceptable for single-user self-hosted (the env is trusted); the hashing prevents timing attacks during comparison.
- `AINA_SECRET`: HMAC key for signing session cookies. If not set, the server generates a random one at startup (lost on restart, which forces re-login — acceptable for dev)

### 1.2 Login Flow

1. User visits any page
2. `hooks.server.ts` `handle` function checks for `aina_session` cookie
3. No valid cookie → redirect to `/login` (for pages) or return `401` (for API routes)
4. User submits credentials on `/login` form
5. `POST /api/auth/login` validates username + scrypt-compares password
6. On success: sets signed HTTP-only cookie, redirects to `/`
7. On failure: returns error, login page shows message

### 1.3 Session Cookie

- **Name**: `aina_session`
- **Value**: `base64({timestamp}).signature`
- **Signature**: HMAC-SHA256 of the payload using `AINA_SECRET` via `crypto.subtle`
- **Attributes**: `HttpOnly`, `SameSite=Lax`, `Secure` (in production), `Path=/`, `Max-Age=604800` (7 days)
- No server-side session store needed — single user means any valid signed cookie is authorized

### 1.4 Route Protection (`hooks.server.ts`)

```
Public routes:
  /login
  /api/auth/login
  /api/auth/logout

Protected routes:
  Everything else
```

- **Distinguishing page vs API**: check if URL path starts with `/api/`
- Page requests (`/`, `/tastemap`, etc.) without valid session → `302` redirect to `/login`
- API requests (`/api/*`) without valid session → `401 JSON` response `{ error: "Unauthorized" }`
- Static assets (handled by SvelteKit before hooks) are unaffected

### 1.5 Logout

- `POST /api/auth/logout` clears the `aina_session` cookie
- Small logout button in the app navigation

### 1.6 Auth Helper Module (`src/lib/server/auth.ts`)

Exports:
- `signCookie(secret: string): string` — creates a signed session value
- `verifyCookie(cookie: string, secret: string): boolean` — validates signature and expiry
- `verifyPassword(submitted: string, expected: string): Promise<boolean>` — constant-time comparison using `crypto.scrypt` + `crypto.timingSafeEqual`

### 1.7 CSRF Protection

The login endpoint (`POST /api/auth/login`) validates the `Origin` header against the server's origin to prevent cross-site request forgery. SvelteKit's built-in CSRF protection covers form actions, but since we use a `+server.ts` API route, we add explicit origin checking. The logout endpoint gets the same treatment.

### 1.8 Login Page (`/login`)

- Centered card with username + password fields and submit button
- Dark theme matching existing design tokens
- Error message displayed on invalid credentials
- No "forgot password" — single user resets via env vars

---

## 2. Demo Data Removal

### 2.1 Files to Delete

| File | Content |
|------|---------|
| `src/lib/utils/demoData.ts` | 21-item demo dataset + `getDemoItem()` |

### 2.2 Files to Clean Up

| File | Change |
|------|--------|
| `src/routes/+page.svelte` | Remove `demoItems` array (lines ~37-59) and fallback logic. Show `EmptyState` when `data.items` is empty. |
| `src/routes/tastemap/+page.svelte` | Remove inline hardcoded demo cluster arrays and demo node arrays defined at the top of the script. Wire the D3 visualization to data from the server loader (`data.clusters`, `data.items`). Show `EmptyState` when arrays are empty. |
| `src/routes/timeline/+page.svelte` | Remove inline procedurally generated `streams` array and mathematical noise functions. Wire the D3 stream graph to data from the server loader (`data.streams`). Show `EmptyState` when no stream data. |
| `src/routes/item/[id]/+page.server.ts` | Remove `getDemoItem()` import and fallback. Return 404 when item not found. |

### 2.3 Server Loaders

- Keep `isDbAvailable()` checks
- Return empty arrays when DB is unavailable (not demo data)
- Pages handle empty arrays via the `EmptyState` component

---

## 3. Empty State Component

### `src/lib/components/shared/EmptyState.svelte`

Props:
- `icon?: string` — optional icon/emoji
- `heading: string` — main message
- `subtitle?: string` — supporting text
- `cta?: { label: string, href: string }` — optional call-to-action button

### Per-Page Copy

| Page | Heading | Subtitle |
|------|---------|----------|
| Library | Your collection is empty | Save your first item to get started |
| Tastemap | Not enough data yet | Save a few items and your taste map will emerge |
| Timeline | No history yet | Your timeline builds as you save items over time |

Styled with existing design tokens: `--text-secondary`, `--font-display` for heading, centered layout.

---

## 4. New & Modified Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/hooks.server.ts` | Auth handle hook — cookie check, route protection |
| `src/routes/login/+page.svelte` | Login form page |
| `src/routes/api/auth/login/+server.ts` | POST — validate credentials, set cookie |
| `src/routes/api/auth/logout/+server.ts` | POST — clear cookie |
| `src/lib/server/auth.ts` | Cookie signing, password verification helpers |
| `src/lib/components/shared/EmptyState.svelte` | Reusable empty state component |

### Modified Files

| File | Change |
|------|--------|
| `src/routes/+page.svelte` | Remove demo fallback, add empty state |
| `src/routes/tastemap/+page.svelte` | Remove demo data, wire to loader, add empty state |
| `src/routes/timeline/+page.svelte` | Remove demo data, wire to loader, add empty state |
| `src/routes/item/[id]/+page.server.ts` | Remove getDemoItem fallback |
| `.env.example` | Add `AINA_USER`, `AINA_PASSWORD`, `AINA_SECRET` |

### Deleted Files

| File | Reason |
|------|---------|
| `src/lib/utils/demoData.ts` | No longer needed |

### Dependencies Added

None — uses Node.js built-in `crypto` module (`scrypt`, `timingSafeEqual`, `subtle`).

---

## 5. What Does NOT Change

- Database schema — no users table
- AI pipeline (embeddings, clustering, insights)
- Existing API route logic (just wrapped with auth check)
- Stores and components not listed above
- CSS architecture and design tokens
