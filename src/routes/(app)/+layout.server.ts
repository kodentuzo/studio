import { redirect } from '@sveltejs/kit';
import { listTeams } from '#lib/server/teams.js';
import type { LayoutServerLoad } from './$types';

// A server load makes every move into these pages ask the server first, including clicks on
// links. Without it the browser swaps pages on its own and the guard in hooks.server.ts never runs.
export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		redirect(303, '/auth/sign-in');
	}

	// The team the sidebar's links lead into: the one in the address, or else the oldest.
	const teams = await listTeams();
	const team = teams.find((team) => team.slug === params.team) ?? teams[0] ?? null;

	return {
		user: locals.user,
		team: team && { slug: team.slug, name: team.name },
		// Every team, for the switcher at the top of the sidebar.
		teams: teams.map(({ slug, name }) => ({ slug, name }))
	};
};
