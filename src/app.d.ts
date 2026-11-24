// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, User } from 'better-auth';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The signed-in user, or null when nobody is signed in. */
			user: User | null;
			session: Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
