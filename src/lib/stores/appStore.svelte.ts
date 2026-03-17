import type { Item } from '$lib/utils/types';

// All mutable state lives in a single non-exported object.
// Consumers read via exported getter functions & mutate via exported actions.

let _selectedClusterId: string | null = $state(null);
let _searchQuery: string = $state('');
let _searchResults: Item[] = $state([]);
let _isSearching: boolean = $state(false);
let _searchOpen: boolean = $state(false);
let _toastMessage: string = $state('');
let _toastType: 'success' | 'error' | 'info' = $state('info');
let _toastVisible: boolean = $state(false);
let _quickAddOpen: boolean = $state(false);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let searchDebounce: ReturnType<typeof setTimeout> | undefined;

// ── Getters (exported as functions so they are reactive when called in templates) ──

export function getSelectedClusterId() {
	return _selectedClusterId;
}
export function getSearchQuery() {
	return _searchQuery;
}
export function getSearchResults() {
	return _searchResults;
}
export function getIsSearching() {
	return _isSearching;
}
export function getSearchOpen() {
	return _searchOpen;
}
export function getToastMessage() {
	return _toastMessage;
}
export function getToastType() {
	return _toastType;
}
export function getToastVisible() {
	return _toastVisible;
}
export function getQuickAddOpen() {
	return _quickAddOpen;
}

// ── Actions ──

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
	if (toastTimer) clearTimeout(toastTimer);
	_toastMessage = message;
	_toastType = type;
	_toastVisible = true;
	toastTimer = setTimeout(() => {
		_toastVisible = false;
	}, 3000);
}

export function hideToast() {
	_toastVisible = false;
}

export function selectCluster(clusterId: string | null) {
	_selectedClusterId = clusterId;
}

export function openSearch() {
	_searchOpen = true;
}

export function closeSearch() {
	_searchOpen = false;
	_searchQuery = '';
	_searchResults = [];
	_isSearching = false;
}

export function openQuickAdd() {
	_quickAddOpen = true;
}

export function closeQuickAdd() {
	_quickAddOpen = false;
}

export async function performSearch(query: string) {
	_searchQuery = query;

	if (!query.trim()) {
		_searchResults = [];
		_isSearching = false;
		return;
	}

	if (searchDebounce) clearTimeout(searchDebounce);

	searchDebounce = setTimeout(async () => {
		_isSearching = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			if (res.ok) {
				const data = await res.json();
				_searchResults = data.results ?? data;
			}
		} catch (e) {
			console.error('Search failed:', e);
		} finally {
			_isSearching = false;
		}
	}, 300);
}

// ── View Transition state ──
// Shared between Library and Item Detail for hero morph continuity
let _viewTransitionItemId: string | null = $state(null);

export function getViewTransitionItemId() {
	return _viewTransitionItemId;
}

export function setViewTransitionItemId(id: string | null) {
	_viewTransitionItemId = id;
}
