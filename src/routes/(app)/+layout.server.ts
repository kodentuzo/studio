import { redirect } from '@sveltejs/kit';
import {
	findOrganization,
	findOrganizationOf,
	managesMembers
} from '#lib/server/organizations.js';
import { listTeamsOf } from '#lib/server/teams.js';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
//
// These pages are for members of the organization this Studio belongs to. Before Studio has
// been set up, they lead to the page that does that; and someone who is not a member is told so.
export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	const organization = await findOrganizationOf(locals.user.id);
	if (!organization) {
		redirect(303, (await findOrganization()) ? '/not-a-member' : '/setup');
	}

	// The teams the person sees, for the switcher at the top of the sidebar, and the one it
	// shows: the team in the address, or else the oldest.
	const canManageTeams = managesMembers(organization);
	const teams = (await listTeamsOf(locals.user.id, canManageTeams)).map(({ slug, name }) => ({
		slug,
		name
	}));

	return {
		user: locals.user,
		organization: { name: organization.name },
		teams,
		team: teams.find((team) => team.slug === params.team) ?? teams[0] ?? null,
		canManageTeams
	};
};
