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

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	// ── Sliding indicator ────────────────────────
	let linksContainer: HTMLDivElement | undefined = $state();
	let indicatorStyle = $state('');

	function updateIndicator() {
		if (!linksContainer) return;
		const activeEl = linksContainer.querySelector('.nav-link.active') as HTMLElement | null;
		if (!activeEl) {
			indicatorStyle = 'opacity: 0';
			return;
		}
		const containerRect = linksContainer.getBoundingClientRect();
		const activeRect = activeEl.getBoundingClientRect();
		const left = activeRect.left - containerRect.left;
		indicatorStyle = `width: ${activeRect.width}px; transform: translateX(${left}px); opacity: 1`;
	}

	$effect(() => {
		// Re-run when pathname changes
		$page.url.pathname;
		// Wait a tick for the DOM to update active classes
		requestAnimationFrame(updateIndicator);
	});
</script>

<nav class="navbar" aria-label="Main navigation" style="view-transition-name: navbar">
	<div class="navbar-inner">
		<!-- Left: Logo -->
		<a href="/" class="navbar-logo">Artifakt</a>

		<!-- Center: Nav links (desktop) -->
		<div class="navbar-links" bind:this={linksContainer}>
			<span class="nav-indicator" style={indicatorStyle} aria-hidden="true"></span>
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
			<button class="nav-icon-btn" onclick={handleLogout} aria-label="Sign out" title="Sign out">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
					<polyline points="16 17 21 12 16 7" />
					<line x1="21" y1="12" x2="9" y2="12" />
				</svg>
			</button>

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
		padding: var(--space-sm) 220px;
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
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	/* Sliding pill that follows the active link */
	.nav-indicator {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.06);
		transition: transform 320ms cubic-bezier(0.25, 0.1, 0.0, 1),
			width 320ms cubic-bezier(0.25, 0.1, 0.0, 1),
			opacity 200ms ease;
		pointer-events: none;
		will-change: transform, width;
	}

	.nav-link {
		position: relative;
		z-index: 1;
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-tertiary);
		text-decoration: none;
		padding: 6px 14px;
		border-radius: var(--radius-full);
		transition: color var(--duration-fast) var(--ease-out);
	}

	.nav-link:hover {
		color: var(--text-secondary);
	}

	.nav-link.active {
		color: var(--text-primary);
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
