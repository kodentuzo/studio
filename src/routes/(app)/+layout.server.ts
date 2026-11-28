import { redirect } from '@sveltejs/kit';
import { listOrganizations } from '#lib/server/organizations.js';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	// The person's organizations, and the one the sidebar's links lead into: the one in the
	// address, or else the oldest.
	const organizations = await listOrganizations(locals.user.id);
	const organization =
		organizations.find((other) => other.slug === params.organization) ?? organizations[0] ?? null;

	return {
		user: locals.user,
		organization: organization && { slug: organization.slug, name: organization.name },
		// Every organization, for the switcher at the top of the sidebar.
		organizations: organizations.map(({ slug, name }) => ({ slug, name }))
	};
};
