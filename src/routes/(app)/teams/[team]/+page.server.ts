import { requireTeam } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// A team's own page. One that is unknown, or that the person may not see, is "not found".
export const load: PageServerLoad = async ({ params }) => {
	const team = await requireTeam(params.team);
	return {
		current: {
			name: team.name,
			slug: team.slug,
			memberCount: team.memberCount,
			// A personal team is one person's own, and has no settings.
			personal: team.personalUserId !== null,
			createdAt: team.createdAt
		}
	};
};
