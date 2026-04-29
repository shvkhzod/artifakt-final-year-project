<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as appStore from '$lib/stores/appStore.svelte';
	import { createFocusTrap } from '$lib/utils/focusTrap';
	import { isYouTubeUrl } from '$lib/utils/youtube';

	type Tab = 'link' | 'text' | 'image';

	let modalEl: HTMLDivElement | undefined = $state();
	const handleFocusTrap = createFocusTrap(() => modalEl);

	let activeTab: Tab = $state('link');

	// Link tab state
	let linkUrl: string = $state('');
	let linkPreview: { title: string; image: string | null; source: string } | null = $state(null);
	let linkLoading: boolean = $state(false);
	let linkError: string = $state('');

	// Text tab state
	let textContent: string = $state('');
	let textAttribution: string = $state('');

	// Image tab state
	let imageFile: File | null = $state(null);
	let imagePreviewUrl: string = $state('');
	let fileInput: HTMLInputElement | undefined = $state();
	let isDraggingOver: boolean = $state(false);

	// Saving state
	let isSaving: boolean = $state(false);

	const isValid = $derived.by(() => {
		if (activeTab === 'link') return linkUrl.trim().length > 0 && /^https?:\/\/.+/i.test(linkUrl.trim());
		if (activeTab === 'text') return textContent.trim().length > 0;
		if (activeTab === 'image') return imageFile !== null;
		return false;
	});

	function resetState() {
		activeTab = 'link';
		linkUrl = '';
		linkPreview = null;
		linkLoading = false;
		linkError = '';
		textContent = '';
		textAttribution = '';
		imageFile = null;
		imagePreviewUrl = '';
		isDraggingOver = false;
		isSaving = false;
	}

	function handleClose() {
		resetState();
		appStore.closeQuickAdd();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
			return;
		}
		handleFocusTrap(e);
	}

	// Focus first input when modal opens
	$effect(() => {
		if (appStore.getQuickAddOpen() && modalEl) {
			const firstInput = modalEl.querySelector<HTMLElement>('input, textarea, button');
			if (firstInput) setTimeout(() => firstInput.focus(), 50);
		}
	});

	function handleBackdropClick(e: MouseEvent) {
		if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
			handleClose();
		}
	}

	async function fetchPreview() {
		const url = linkUrl.trim();
		if (!url || !/^https?:\/\/.+/i.test(url)) return;

		linkLoading = true;
		linkError = '';
		linkPreview = null;

		try {
			const res = await fetch(`/api/items/preview?url=${encodeURIComponent(url)}`);
			if (res.ok) {
				linkPreview = await res.json();
			} else {
				linkError = 'Could not fetch preview';
			}
		} catch {
			linkError = 'Could not fetch preview';
		} finally {
			linkLoading = false;
		}
	}

	function handleLinkPaste() {
		// Small delay to let the paste value populate
		setTimeout(fetchPreview, 50);
	}

	function handleLinkBlur() {
		if (linkUrl.trim() && !linkPreview && !linkLoading) {
			fetchPreview();
		}
	}

	function handleImageDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (file.type.startsWith('image/')) {
				setImageFile(file);
			}
		}
	}

	function handleImageSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			setImageFile(input.files[0]);
		}
	}

	function setImageFile(file: File) {
		imageFile = file;
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		imagePreviewUrl = URL.createObjectURL(file);
	}

	function clearImage() {
		imageFile = null;
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		imagePreviewUrl = '';
		if (fileInput) fileInput.value = '';
	}

	async function handleSave() {
		if (!isValid || isSaving) return;
		isSaving = true;

		try {
			if (activeTab === 'link') {
				const url = linkUrl.trim();
				const response = await fetch('/api/items', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						url,
						title: linkPreview?.title || null,
						type: isYouTubeUrl(url) ? 'video' : 'article',
					}),
				});
				if (!response.ok) throw new Error('Save failed');
			} else if (activeTab === 'text') {
				const response = await fetch('/api/items', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						content: textContent.trim(),
						note: textAttribution.trim() || null,
						type: 'quote',
					}),
				});
				if (!response.ok) throw new Error('Save failed');
			} else if (activeTab === 'image' && imageFile) {
				const formData = new FormData();
				formData.append('file', imageFile);
				formData.append('type', 'image');
				const response = await fetch('/api/items', {
					method: 'POST',
					body: formData,
				});
				if (!response.ok) throw new Error('Save failed');
			}

			appStore.showToast('Saved to your library', 'success');
			handleClose();
			await invalidateAll();
		} catch {
			appStore.showToast('Failed to save', 'error');
		} finally {
			isSaving = false;
		}
	}

	function extractDomain(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

{#if appStore.getQuickAddOpen()}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Quick add"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal" bind:this={modalEl}>
			<button class="close-btn" onclick={handleClose} aria-label="Close">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6L6 18" />
					<path d="M6 6l12 12" />
				</svg>
			</button>

			<div class="tabs">
				<button class="tab" class:active={activeTab === 'link'} onclick={() => activeTab = 'link'}>Link</button>
				<button class="tab" class:active={activeTab === 'text'} onclick={() => activeTab = 'text'}>Text</button>
				<button class="tab" class:active={activeTab === 'image'} onclick={() => activeTab = 'image'}>Image</button>
			</div>

			<div class="tab-content">
				{#if activeTab === 'link'}
					<div class="link-tab">
						<input
							type="url"
							class="input"
							placeholder="Paste a URL..."
							bind:value={linkUrl}
							onpaste={handleLinkPaste}
							onblur={handleLinkBlur}
						/>
						{#if linkLoading}
							<div class="preview-loading">
								<div class="shimmer-bar"></div>
								<div class="shimmer-bar short"></div>
							</div>
						{/if}
						{#if linkError}
							<p class="preview-error">{linkError}</p>
						{/if}
						{#if linkPreview}
							<div class="link-preview-card">
								{#if linkPreview.image}
									<img class="preview-thumb" src={linkPreview.image} alt="" />
								{/if}
								<div class="preview-info">
									<p class="preview-title">{linkPreview.title}</p>
									<p class="preview-source">{extractDomain(linkUrl)}</p>
								</div>
							</div>
						{/if}
					</div>
				{:else if activeTab === 'text'}
					<div class="text-tab">
						<textarea
							class="textarea"
							placeholder="Type or paste text..."
							rows="5"
							bind:value={textContent}
						></textarea>
						<input
							type="text"
							class="input attribution"
							placeholder="Attribution (optional)"
							bind:value={textAttribution}
						/>
					</div>
				{:else if activeTab === 'image'}
					<div class="image-tab">
						{#if imagePreviewUrl}
							<div class="image-preview">
								<img src={imagePreviewUrl} alt="Selected" />
								<button class="remove-image" onclick={clearImage} aria-label="Remove image">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M18 6L6 18" />
										<path d="M6 6l12 12" />
									</svg>
								</button>
							</div>
						{:else}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="drop-zone"
								class:drag-over={isDraggingOver}
								onclick={() => fileInput?.click()}
								ondragover={(e) => { e.preventDefault(); isDraggingOver = true; }}
								ondragleave={() => { isDraggingOver = false; }}
								ondrop={handleImageDrop}
							>
								<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
									<circle cx="8.5" cy="8.5" r="1.5" />
									<polyline points="21 15 16 10 5 21" />
								</svg>
								<p class="drop-text">Drop an image or click to browse</p>
							</div>
							<input
								type="file"
								accept="image/*"
								class="file-input-hidden"
								bind:this={fileInput}
								onchange={handleImageSelect}
							/>
						{/if}
					</div>
				{/if}
			</div>

			<button
				class="save-btn"
				disabled={!isValid || isSaving}
				onclick={handleSave}
			>
				{#if isSaving}
					Saving...
				{:else}
					Save
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	.modal {
		position: relative;
		width: 90vw;
		max-width: 480px;
		background: var(--bg-surface-1);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		animation: scaleIn var(--duration-normal) var(--ease-out);
	}

	.close-btn {
		position: absolute;
		top: var(--space-md);
		right: var(--space-md);
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast) var(--ease-out);
	}

	.close-btn:hover {
		color: var(--text-primary);
	}

	/* ── Tabs ───────────────────────────────────── */
	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: var(--space-lg);
		background: rgba(255, 255, 255, 0.03);
		border-radius: var(--radius-full);
		padding: 3px;
	}

	.tab {
		flex: 1;
		padding: 7px var(--space-md);
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--text-tertiary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.tab:hover {
		color: var(--text-secondary);
	}

	.tab.active {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	/* ── Tab Content ────────────────────────────── */
	.tab-content {
		min-height: 180px;
	}

	/* ── Shared Inputs ──────────────────────────── */
	.input,
	.textarea {
		width: 100%;
		background: rgba(255, 255, 255, 0.04);
		border: none;
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		caret-color: var(--accent-sage);
		outline: none;
		transition: background var(--duration-fast) var(--ease-out);
		box-sizing: border-box;
	}

	.input:focus,
	.textarea:focus {
		background: rgba(255, 255, 255, 0.06);
	}

	.input::placeholder,
	.textarea::placeholder {
		color: var(--text-tertiary);
	}

	.textarea {
		resize: vertical;
		min-height: 120px;
		line-height: var(--leading-normal);
	}

	.attribution {
		margin-top: var(--space-sm);
	}

	/* ── Link Tab ───────────────────────────────── */
	.preview-loading {
		margin-top: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.shimmer-bar {
		height: 14px;
		border-radius: var(--radius-sm);
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.08) 50%,
			rgba(255, 255, 255, 0.04) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}

	.shimmer-bar.short {
		width: 60%;
	}

	.preview-error {
		margin-top: var(--space-sm);
		font-size: var(--text-xs);
		color: var(--cluster-vermillion);
	}

	.link-preview-card {
		margin-top: var(--space-md);
		display: flex;
		gap: var(--space-sm);
		background: rgba(255, 255, 255, 0.03);
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid var(--border-subtle);
	}

	.preview-thumb {
		width: 80px;
		height: 64px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.preview-info {
		padding: var(--space-sm);
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	.preview-title {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
		line-height: var(--leading-snug);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-source {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin-top: 2px;
	}

	/* ── Image Tab ──────────────────────────────── */
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-2xl) var(--space-lg);
		border: 2px dashed var(--border-light);
		border-radius: var(--radius-md);
		cursor: pointer;
		color: var(--text-tertiary);
		transition: border-color var(--duration-fast) var(--ease-out),
			background var(--duration-fast) var(--ease-out);
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--accent-sage);
		background: rgba(123, 158, 135, 0.05);
	}

	.drop-text {
		font-size: var(--text-sm);
	}

	.file-input-hidden {
		display: none;
	}

	.image-preview {
		position: relative;
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.image-preview img {
		width: 100%;
		max-height: 240px;
		object-fit: contain;
		display: block;
		border-radius: var(--radius-md);
		background: rgba(255, 255, 255, 0.02);
	}

	.remove-image {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: var(--text-primary);
		cursor: pointer;
		display: grid;
		place-items: center;
		backdrop-filter: blur(4px);
		transition: background var(--duration-fast) var(--ease-out);
	}

	.remove-image:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	/* ── Save Button ────────────────────────────── */
	.save-btn {
		width: 100%;
		margin-top: var(--space-lg);
		padding: var(--space-sm) var(--space-lg);
		border: none;
		border-radius: var(--radius-md);
		background: var(--accent-sage);
		color: var(--text-on-accent);
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.save-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.save-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.save-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
