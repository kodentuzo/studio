import { redirect } from '@sveltejs/kit';
import { listTeams } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// Leads on to the oldest team. With no teams at all, the page says so.
export const load: PageServerLoad = async () => {
	const [first] = await listTeams();
	if (first) redirect(303, `/teams/${first.slug}`);

	return {};
};
