const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'textarea:not([disabled])',
	'select:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Returns a keydown handler that traps Tab focus within the given container.
 * Attach to the container's `onkeydown` event.
 */
export function createFocusTrap(getContainer: () => HTMLElement | null | undefined) {
	return function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const container = getContainer();
		if (!container) return;

		const focusable = Array.from(
			container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
		).filter((el) => el.offsetParent !== null); // visible only

		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === first) {
				event.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	};
}
