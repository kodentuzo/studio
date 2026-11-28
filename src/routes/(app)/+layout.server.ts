import { redirect } from '@sveltejs/kit';
import { findOrganization, findOrganizationOf } from '#lib/server/organizations.js';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
//
// These pages are for members of the organization this Studio belongs to. Before Studio has
// been set up, they lead to the page that does that; and someone who is not a member is told so.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	const organization = await findOrganizationOf(locals.user.id);
	if (!organization) {
		redirect(303, (await findOrganization()) ? '/not-a-member' : '/setup');
	}

	return { user: locals.user, organization: { name: organization.name } };
};
