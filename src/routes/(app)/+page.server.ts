import { managesMembers, requireOrganization } from '#lib/server/organizations.js';
import { loadOverview } from '#lib/server/overview.js';
import { listTeamsOf } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// The organization's overview: its money, and the latest projects in the teams the person sees.
export const load: PageServerLoad = async ({ locals }) => {
	const organization = await requireOrganization();
	const teams = await listTeamsOf(locals.user!.id, managesMembers(organization));
	return {
		overview: await loadOverview(
			null,
			teams.map((team) => team.id)
		),
		projectsUrl: '/projects',
		// The organization's projects come from several teams, so each says which.
		showTeam: true
	};
};
