import { redirect } from '@sveltejs/kit';
import { AUTH_URL } from '$app/env/private';
import {
	findOrganization,
	findOrganizationOf,
	managesMembers
} from '#lib/server/organizations.js';
import { listTeamsOf, personalTeamOf } from '#lib/server/teams.js';
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

	// Everyone in the organization has a personal team. This is where it is made, the first
	// time they arrive.
	await personalTeamOf(organization, locals.user);

	// The organization's teams the person sees, and the one the sidebar follows: the team in the address, or
	// else the oldest.
	const canManageTeams = managesMembers(organization);
	const teams = (await listTeamsOf(locals.user.id, canManageTeams)).map(({ slug, name }) => ({
		slug,
		name
	}));

	return {
		user: locals.user,
		organization: { slug: organization.slug, name: organization.name },
		teams,
		team: teams.find((team) => team.slug === params.team) ?? teams[0] ?? null,
		canManageTeams,
		// Where the person's own pages are: the account service.
		authUrl: AUTH_URL
	};
};
