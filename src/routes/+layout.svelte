<script lang="ts">
	import '$lib/styles/reset.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import '$lib/styles/utils.css';

	import { onNavigate } from '$app/navigation';
	import NavBar from '$lib/components/shared/NavBar.svelte';
	import SearchOverlay from '$lib/components/shared/SearchOverlay.svelte';
	import { Toast, QuickAddModal } from '$lib/components/shared';
	import * as appStore from '$lib/stores/appStore.svelte';

	let { children } = $props();

	// ── Page transition direction ───────────────────
	// Routes ordered spatially left → right
	const routeOrder: Record<string, number> = {
		'/': 0,
		'/tastemap': 1,
		'/timeline': 2,
	};

	function getRouteIndex(pathname: string): number {
		if (pathname.startsWith('/item/')) return -1; // item detail handled separately
		return routeOrder[pathname] ?? -1;
	}

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		const from = navigation.from?.url.pathname ?? '';
		const to = navigation.to?.url.pathname ?? '';

		// Item detail transitions are handled by the card click handler
		if (from.startsWith('/item/') || to.startsWith('/item/')) return;

		const fromIdx = getRouteIndex(from);
		const toIdx = getRouteIndex(to);

		// Only animate between known main pages
		if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

		// Set direction on <html> so our view-transition CSS can read it
		const direction = toIdx > fromIdx ? 'forward' : 'backward';
		document.documentElement.dataset.vtDirection = direction;

		return new Promise((resolve) => {
			const transition = document.startViewTransition!(async () => {
				resolve();
				await navigation.complete;
			});
			// Clean up direction attribute after transition completes
			transition.finished.then(() => {
				delete document.documentElement.dataset.vtDirection;
			}).catch(() => {
				delete document.documentElement.dataset.vtDirection;
			});
		});
	});

	function isURL(text: string): boolean {
		return /^https?:\/\/.+/i.test(text.trim());
	}

	async function saveFromInput(data: Record<string, any> | FormData): Promise<any> {
		const isFormData = data instanceof FormData;
		const response = await fetch('/api/items', {
			method: 'POST',
			...(isFormData
				? { body: data }
				: { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
		});
		if (!response.ok) throw new Error('Save failed');
		return response.json();
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		// Cmd+K or Ctrl+K to open search
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			appStore.openSearch();
		}
		// Cmd+N or Ctrl+N to open quick-add
		if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
			event.preventDefault();
			appStore.openQuickAdd();
		}
	}

	async function handleGlobalPaste(event: ClipboardEvent) {
		// Skip if user is typing in an input, textarea, or contentEditable
		const target = event.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable
		) {
			return;
		}

		const clipboardData = event.clipboardData;
		if (!clipboardData) return;

		// Check for image files in clipboard
		const imageFile = Array.from(clipboardData.files).find((f) => f.type.startsWith('image/'));
		if (imageFile) {
			event.preventDefault();
			try {
				const formData = new FormData();
				formData.append('file', imageFile);
				formData.append('type', 'image');
				await saveFromInput(formData);
				appStore.showToast('Image saved to library', 'success');
			} catch {
				appStore.showToast('Failed to save image', 'error');
			}
			return;
		}

		const text = clipboardData.getData('text/plain');
		const html = clipboardData.getData('text/html');

		if (!text && !html) return;
		event.preventDefault();

		try {
			if (text && isURL(text)) {
				// URL detected
				await saveFromInput({ url: text.trim(), type: 'article' });
				appStore.showToast('Link saved to library', 'success');
			} else if (html && html.trim().length > 0) {
				// HTML content — save as quote
				await saveFromInput({ content: text || html, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			} else if (text) {
				// Plain text — save as quote
				await saveFromInput({ content: text, type: 'quote' });
				appStore.showToast('Text saved to library', 'success');
			}
		} catch {
			appStore.showToast('Failed to save', 'error');
		}
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />
<svelte:document onpaste={handleGlobalPaste} />

<a href="#main-content" class="skip-link">Skip to content</a>

<div class="app">
	<NavBar />
	<main id="main-content" class="app-content">
		{@render children()}
	</main>
	<SearchOverlay />
	<QuickAddModal />
	<Toast message={appStore.getToastMessage()} type={appStore.getToastType()} visible={appStore.getToastVisible()} onclose={appStore.hideToast} />
</div>

<style>
	.skip-link {
		position: absolute;
		top: -100%;
		left: var(--space-md);
		z-index: var(--z-toast);
		padding: var(--space-xs) var(--space-md);
		background: var(--accent-sage);
		color: var(--text-on-accent);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		text-decoration: none;
	}

	.skip-link:focus {
		top: var(--space-md);
	}

	.app {
		min-height: 100vh;
	}

	.app-content {
		padding-top: var(--navbar-height);
	}
</style>
