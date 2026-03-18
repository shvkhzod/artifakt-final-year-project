<script lang="ts">
  interface TrailItem {
    id: string;
    title: string | null;
    type: string;
  }

  let {
    trail,
    onnavigate,
  }: {
    trail: TrailItem[];
    onnavigate: (id: string, index: number) => void;
  } = $props();

  const MAX_VISIBLE = 8;
  const MAX_TITLE_LENGTH = 20;

  let visibleTrail = $derived(
    trail.length > MAX_VISIBLE ? trail.slice(trail.length - MAX_VISIBLE) : trail
  );

  let hasOverflow = $derived(trail.length > MAX_VISIBLE);

  function truncate(title: string | null): string {
    if (!title) return 'Untitled';
    return title.length > MAX_TITLE_LENGTH
      ? title.slice(0, MAX_TITLE_LENGTH) + '\u2026'
      : title;
  }

  function handleClick(item: TrailItem, visibleIndex: number) {
    const actualIndex = hasOverflow
      ? trail.length - MAX_VISIBLE + visibleIndex
      : visibleIndex;
    onnavigate(item.id, actualIndex);
  }
</script>

<nav class="exploration-breadcrumbs" aria-label="Exploration trail">
  <span class="exploration-label">Exploring</span>

  <div class="trail-scroll">
    <div class="trail-inner">
      {#if hasOverflow}
        <span class="trail-ellipsis">&hellip;</span>
        <span class="trail-separator" aria-hidden="true">&rarr;</span>
      {/if}

      {#each visibleTrail as item, i (item.id + '-' + i)}
        {#if i > 0}
          <span class="trail-separator" aria-hidden="true">&rarr;</span>
        {/if}
        <button
          class="trail-pill"
          onclick={() => handleClick(item, i)}
          title={item.title ?? 'Untitled'}
        >
          {truncate(item.title)}
        </button>
      {/each}
    </div>
  </div>
</nav>

<style>
  .exploration-breadcrumbs {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    max-height: 32px;
    position: relative;
  }

  .exploration-label {
    font-family: var(--font-body);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-ghost);
    flex-shrink: 0;
    line-height: 1;
    user-select: none;
  }

  .trail-scroll {
    position: relative;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    min-width: 0;
    mask-image: linear-gradient(
      to right,
      transparent 0px,
      black 20px,
      black 100%
    );
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0px,
      black 20px,
      black 100%
    );
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .trail-inner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 4px;
    white-space: nowrap;
  }

  .trail-ellipsis {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-ghost);
    line-height: 1;
    user-select: none;
  }

  .trail-separator {
    font-size: 9px;
    color: var(--text-ghost);
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  }

  .trail-pill {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-ghost);
    background: none;
    border: none;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
    transition: color var(--duration-fast) var(--ease-out);

    &:hover {
      color: var(--text-tertiary);
    }

    &:focus-visible {
      outline: 1px solid var(--border-subtle);
      outline-offset: 1px;
    }

    &:last-child {
      color: var(--text-tertiary);
    }
  }
</style>
