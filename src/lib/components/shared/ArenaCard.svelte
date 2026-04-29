<script lang="ts">
	import type { ArenaBlock } from '$lib/utils/arena.types';
	import * as appStore from '$lib/stores/appStore.svelte';

	let {
		block,
		onsave,
		onseechannel,
	}: {
		block: ArenaBlock;
		onsave?: (block: ArenaBlock) => void;
		onseechannel?: (slug: string) => void;
	} = $props();

	let saving = $state(false);
	let saved = $state(block.alreadySaved);

	async function handleSave() {
		if (saved || saving) return;
		saving = true;

		try {
			const res = await fetch('/api/explore/save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					arenaId: block.arenaId,
					title: block.title,
					imageUrl: block.imageUrl,
					content: block.contentHtml ? stripHtml(block.contentHtml) : null,
					sourceUrl: block.sourceUrl,
					type: block.blockType === 'text' ? 'quote'
						: block.blockType === 'link' ? 'article'
						: 'image',
				}),
			});

			if (res.status === 409) {
				saved = true;
				appStore.showToast('Already in your library', 'success');
			} else if (res.ok) {
				saved = true;
				appStore.showToast('Saved to library', 'success');
				onsave?.(block);
			} else {
				appStore.showToast('Failed to save', 'error');
			}
		} catch {
			appStore.showToast('Failed to save', 'error');
		} finally {
			saving = false;
		}
	}

	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').trim();
	}

	const primaryChannel = $derived(block.channels[0] ?? null);
</script>

<div class="arena-card" class:saved>
	{#if block.imageUrl}
		<img
			class="arena-card__image"
			src={block.imageUrl}
			alt={block.title || 'Explore result'}
			loading="lazy"
		/>
	{:else if block.contentHtml}
		<p class="arena-card__text">
			{stripHtml(block.contentHtml)}
		</p>
	{/if}

	<div class="arena-card__info">
		{#if block.title}
			<span class="arena-card__title">{block.title}</span>
		{/if}
		{#if primaryChannel}
			<button
				class="arena-card__channel"
				onclick={() => onseechannel?.(primaryChannel.slug)}
			>
				in {primaryChannel.title}
			</button>
		{/if}
	</div>

	<div class="arena-card__actions">
		{#if saved}
			<span class="arena-card__saved-badge">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Saved
			</span>
		{:else}
			<button class="arena-card__save" onclick={handleSave} disabled={saving}>
				{saving ? '...' : 'Save'}
			</button>
		{/if}
		<a class="arena-card__link" href={block.sourceUrl} target="_blank" rel="noopener noreferrer">
			{block.source === 'tumblr' ? 'Tumblr' : 'Are.na'}
		</a>
	</div>
</div>

<style>
	.arena-card {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		width: 140px;
		background: var(--bg-surface-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		overflow: hidden;
		transition: border-color var(--duration-fast) var(--ease-out);
	}

	.arena-card:hover {
		border-color: var(--border-light);
	}

	.arena-card.saved {
		opacity: 0.6;
	}

	.arena-card__image {
		width: 100%;
		height: 90px;
		object-fit: cover;
		display: block;
	}

	.arena-card__text {
		padding: 8px;
		font-family: var(--font-display);
		font-size: 11px;
		font-style: italic;
		line-height: 1.4;
		color: rgba(255, 255, 255, 0.7);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 0;
		height: 90px;
	}

	.arena-card__info {
		padding: 6px 8px 2px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 0;
	}

	.arena-card__title {
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.arena-card__channel {
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--text-ghost);
		font-style: italic;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.arena-card__channel:hover {
		color: var(--text-tertiary);
	}

	.arena-card__actions {
		padding: 4px 8px 6px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}

	.arena-card__save {
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 500;
		color: var(--accent-sage);
		background: none;
		border: 1px solid rgba(123, 158, 135, 0.3);
		border-radius: var(--radius-full);
		padding: 2px 8px;
		cursor: pointer;
		transition: background var(--duration-fast) var(--ease-out);
	}

	.arena-card__save:hover {
		background: rgba(123, 158, 135, 0.1);
	}

	.arena-card__save:disabled {
		opacity: 0.5;
		cursor: wait;
	}

	.arena-card__saved-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--text-ghost);
	}

	.arena-card__link {
		font-family: var(--font-body);
		font-size: 9px;
		color: var(--text-ghost);
		text-decoration: none;
		letter-spacing: 0.03em;
		transition: color var(--duration-fast) var(--ease-out);
	}

	.arena-card__link:hover {
		color: var(--text-tertiary);
	}
</style>
