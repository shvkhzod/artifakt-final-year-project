<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let shake = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		shake = false;
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
				shake = true;
				setTimeout(() => (shake = false), 500);
			}
		} catch {
			error = 'Something went wrong';
			shake = true;
			setTimeout(() => (shake = false), 500);
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
	<!-- Ambient glow -->
	<div class="ambient" aria-hidden="true"></div>

	<form class="login-card" class:shake onsubmit={handleSubmit}>
		<header class="login-header">
			<h1 class="login-title">Aina</h1>
			<p class="login-subtitle">Sign in to your collection</p>
		</header>

		{#if error}
			<div class="login-error" role="alert">
				<svg class="error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				{error}
			</div>
		{/if}

		<div class="fields">
			<label class="field">
				<span class="field-label">Username</span>
				<input
					type="text"
					bind:value={username}
					placeholder="Enter your username"
					autocomplete="username"
					autofocus
					required
					disabled={loading}
				/>
			</label>

			<label class="field">
				<span class="field-label">Password</span>
				<input
					type="password"
					bind:value={password}
					placeholder="Enter your password"
					autocomplete="current-password"
					required
					disabled={loading}
				/>
			</label>
		</div>

		<button class="login-btn" type="submit" disabled={loading}>
			{#if loading}
				<span class="spinner" aria-hidden="true"></span>
				Signing in...
			{:else}
				Sign in
			{/if}
		</button>
	</form>
</div>

<style>
	/* ── Page ──────────────────────────────────────── */
	.login-page {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		background: var(--bg-void, #050506);
		padding: var(--space-lg, 1.5rem);
		position: relative;
		overflow: hidden;
	}

	/* Subtle radial glow behind the form */
	.ambient {
		position: absolute;
		top: 40%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 600px;
		height: 600px;
		background: radial-gradient(
			circle,
			rgba(123, 158, 135, 0.06) 0%,
			rgba(123, 158, 135, 0.02) 40%,
			transparent 70%
		);
		pointer-events: none;
	}

	/* ── Card ──────────────────────────────────────── */
	.login-card {
		position: relative;
		width: 100%;
		max-width: 340px;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg, 1.5rem);
	}

	.login-header {
		text-align: center;
		margin-bottom: var(--space-xs, 0.5rem);
	}

	.login-title {
		font-family: var(--font-display, 'Instrument Serif', Georgia, serif);
		font-size: var(--text-3xl, 2.4375rem);
		font-weight: 400;
		color: var(--text-primary, #E8E8E8);
		letter-spacing: var(--tracking-tight, -0.02em);
		margin: 0;
		line-height: var(--leading-tight, 1.2);
	}

	.login-subtitle {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		color: var(--text-tertiary, rgba(255, 255, 255, 0.45));
		margin: var(--space-2xs, 0.25rem) 0 0;
		line-height: var(--leading-normal, 1.6);
	}

	/* ── Error ─────────────────────────────────────── */
	.login-error {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs, 0.5rem);
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		color: var(--cluster-vermillion, #D55E00);
		background: rgba(213, 94, 0, 0.06);
		border: 1px solid rgba(213, 94, 0, 0.15);
		border-radius: var(--radius-sm, 6px);
		padding: var(--space-sm, 0.75rem) var(--space-md, 1rem);
		animation: errorIn var(--duration-normal, 300ms) var(--ease-out, ease) both;
	}

	.error-icon {
		flex-shrink: 0;
		opacity: 0.8;
	}

	@keyframes errorIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Shake ─────────────────────────────────────── */
	.shake {
		animation: shake 400ms var(--ease-out, ease);
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-6px); }
		40% { transform: translateX(5px); }
		60% { transform: translateX(-3px); }
		80% { transform: translateX(2px); }
	}

	/* ── Fields ────────────────────────────────────── */
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-md, 1rem);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs, 0.25rem);
	}

	.field-label {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-xs, 0.75rem);
		font-weight: 500;
		color: var(--text-secondary, rgba(255, 255, 255, 0.55));
		letter-spacing: 0.02em;
		padding-left: 2px;
	}

	.field input {
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-base, 1.0625rem);
		color: var(--text-primary, #E8E8E8);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--border-light, rgba(255, 255, 255, 0.10));
		border-radius: var(--radius-sm, 6px);
		padding: 11px 14px;
		outline: none;
		transition:
			border-color var(--duration-fast, 150ms) var(--ease-out, ease),
			background var(--duration-fast, 150ms) var(--ease-out, ease),
			box-shadow var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.field input::placeholder {
		color: var(--text-ghost, rgba(255, 255, 255, 0.15));
	}

	.field input:hover:not(:disabled) {
		border-color: rgba(255, 255, 255, 0.16);
		background: rgba(255, 255, 255, 0.04);
	}

	.field input:focus {
		border-color: var(--accent-sage, #7B9E87);
		background: rgba(255, 255, 255, 0.04);
		box-shadow: 0 0 0 3px rgba(123, 158, 135, 0.12);
	}

	.field input:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Button ────────────────────────────────────── */
	.login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs, 0.5rem);
		font-family: var(--font-body, 'DM Sans', sans-serif);
		font-size: var(--text-sm, 0.875rem);
		font-weight: 600;
		color: #fff;
		background: var(--accent-sage, #7B9E87);
		border: none;
		border-radius: var(--radius-sm, 6px);
		padding: 0;
		height: 44px;
		cursor: pointer;
		margin-top: var(--space-2xs, 0.25rem);
		transition:
			background var(--duration-fast, 150ms) var(--ease-out, ease),
			transform var(--duration-fast, 150ms) var(--ease-out, ease),
			box-shadow var(--duration-fast, 150ms) var(--ease-out, ease);
	}

	.login-btn:hover:not(:disabled) {
		background: #8aab95;
		box-shadow: 0 2px 12px -2px rgba(123, 158, 135, 0.3);
		transform: translateY(-1px);
	}

	.login-btn:active:not(:disabled) {
		background: #6f9079;
		transform: translateY(0);
		box-shadow: none;
	}

	.login-btn:focus-visible {
		outline: 2px solid var(--accent-sage, #7B9E87);
		outline-offset: 2px;
	}

	.login-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── Spinner ───────────────────────────────────── */
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: var(--radius-full, 9999px);
		animation: spin 600ms linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ── Reduced motion ────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.shake {
			animation: none;
		}

		.login-error {
			animation: none;
		}

		.spinner {
			animation-duration: 1.5s;
		}

		.login-btn,
		.field input {
			transition-duration: 0ms;
		}
	}

	/* ── Mobile ────────────────────────────────────── */
	@media (max-width: 480px) {
		.login-page {
			padding: var(--space-md, 1rem);
			align-content: center;
		}

		.login-card {
			max-width: 100%;
		}

		.ambient {
			width: 400px;
			height: 400px;
		}
	}
</style>
