import { redirect } from '@sveltejs/kit';
import { findOrganizationOf } from '#lib/server/organizations.js';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	// The organization, for the top of the sidebar and its links. Null for someone who does not
	// belong to it, or before Studio has been set up.
	const organization = await findOrganizationOf(locals.user.id);

	return {
		user: locals.user,
		organization: organization && { slug: organization.slug, name: organization.name }
	};
};
