<script lang="ts">
	import { page } from '$app/stores';
	import * as appStore from '$lib/stores/appStore.svelte';

	let mobileMenuOpen = $state(false);

	const navLinks = [
		{ href: '/', label: 'Library' },
		{ href: '/tastemap', label: 'Taste Map' },
		{ href: '/timeline', label: 'Timeline' },
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname.startsWith(href);
	}

	function handleSearchClick() {
		appStore.openSearch();
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<nav class="navbar" aria-label="Main navigation">
	<div class="navbar-inner">
		<!-- Left: Logo -->
		<a href="/" class="navbar-logo">Aina</a>

		<!-- Center: Nav links (desktop) -->
		<div class="navbar-links">
			{#each navLinks as link}
				<a
					href={link.href}
					class="nav-link"
					class:active={isActive(link.href, $page.url.pathname)}
					aria-current={isActive(link.href, $page.url.pathname) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</div>

		<!-- Right: Actions -->
		<div class="navbar-actions">
			<button class="nav-icon-btn" onclick={handleSearchClick} aria-label="Search">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
				<span class="kbd-hint">K</span>
			</button>
			<div class="avatar-placeholder" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="8" r="4" />
					<path d="M20 21a8 8 0 0 0-16 0" />
				</svg>
			</div>

			<!-- Mobile hamburger -->
			<button class="hamburger-btn" onclick={toggleMobileMenu} aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					{#if mobileMenuOpen}
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					{:else}
						<path d="M4 8h16" />
						<path d="M4 16h16" />
					{/if}
				</svg>
			</button>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if mobileMenuOpen}
		<div class="mobile-menu">
			{#each navLinks as link}
				<a
					href={link.href}
					class="mobile-nav-link"
					class:active={isActive(link.href, $page.url.pathname)}
					onclick={closeMobileMenu}
				>
					{link.label}
				</a>
			{/each}
		</div>
	{/if}
</nav>

<style>
	/* ── Navbar Container ──────────────────────── */
	.navbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: var(--z-navbar);
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid var(--border-subtle);
	}

	.navbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-lg);
		max-width: 100%;
	}

	/* ── Logo ──────────────────────────────────── */
	.navbar-logo {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 400;
		color: var(--text-primary);
		letter-spacing: var(--tracking-tight);
		text-decoration: none;
		user-select: none;
		flex-shrink: 0;
	}

	/* ── Nav Links (desktop) ───────────────────── */
	.navbar-links {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.nav-link {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-tertiary);
		text-decoration: none;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.nav-link:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
	}

	.nav-link.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	/* ── Actions ───────────────────────────────── */
	.navbar-actions {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		flex-shrink: 0;
	}

	.nav-icon-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-full);
		border: none;
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out),
			color var(--duration-fast) var(--ease-out);
	}

	.nav-icon-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.kbd-hint {
		font-size: var(--text-2xs);
		font-weight: 500;
		color: var(--text-ghost);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		padding: 1px 5px;
		line-height: var(--leading-snug);
	}

	.avatar-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-tertiary);
	}

	/* ── Hamburger (mobile only) ───────────────── */
	.hamburger-btn {
		display: none;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-secondary);
		cursor: pointer;
	}

	.hamburger-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	/* ── Mobile Menu ───────────────────────────── */
	.mobile-menu {
		display: none;
		flex-direction: column;
		padding: var(--space-xs) var(--space-lg) var(--space-md);
		border-top: 1px solid var(--border-subtle);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	.mobile-nav-link {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--text-tertiary);
		text-decoration: none;
		padding: var(--space-sm) var(--space-sm);
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.mobile-nav-link:hover {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
	}

	.mobile-nav-link.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	/* ── Responsive ────────────────────────────── */
	@media (max-width: 640px) {
		.navbar-links {
			display: none;
		}

		.avatar-placeholder {
			display: none;
		}

		.hamburger-btn {
			display: flex;
		}

		.mobile-menu {
			display: flex;
		}

		.navbar-inner {
			padding: var(--space-xs) var(--space-md);
		}

		.kbd-hint {
			display: none;
		}
	}
</style>
