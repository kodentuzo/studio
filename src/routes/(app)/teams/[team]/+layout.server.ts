import { requireTeam } from '#lib/server/teams.js';
import type { LayoutServerLoad } from './$types';

// Every page under /teams/<slug> is about that team. One that is unknown, or that the person
// may not see, is "not found": also for a page that asks for nothing itself.
export const load: LayoutServerLoad = async ({ params }) => {
	await requireTeam(params.team);
	return {};
};
