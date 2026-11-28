import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Leads on to the oldest team the person sees. With none, to the form that makes one for those
// who may, and to the overview for everyone else.
export const load: PageServerLoad = async ({ parent }) => {
	const { team, canManageTeams } = await parent();
	redirect(303, team ? `/teams/${team.slug}` : canManageTeams ? '/teams/new' : '/');
};
