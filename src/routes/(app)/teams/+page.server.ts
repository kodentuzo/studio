import { redirect } from '@sveltejs/kit';
import { listTeams } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// Leads on to the oldest team. With no teams at all, to the form that creates the first one.
export const load: PageServerLoad = async () => {
	const [first] = await listTeams();
	redirect(303, first ? `/teams/${first.slug}` : '/teams/new');
};
