// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface ViewTransition {
		finished: Promise<void>;
		ready: Promise<void>;
		updateCallbackDone: Promise<void>;
		skipTransition(): void;
	}

	interface Document {
		startViewTransition?(callback: () => Promise<void> | void): ViewTransition;
	}
}

export {};
