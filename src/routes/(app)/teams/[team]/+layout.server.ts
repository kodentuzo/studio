import { requireTeam } from '#lib/server/teams.js';
import type { LayoutServerLoad } from './$types';

// Every page under /teams/<slug> is about that team. An unknown one is "not found".
export const load: LayoutServerLoad = async ({ params }) => {
	const team = await requireTeam(params.team);
	return { team: { slug: team.slug, name: team.name } };
};
