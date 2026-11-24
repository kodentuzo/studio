import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	return { user: locals.user };
};
