import { financeActions, loadFinances } from '#lib/server/finances.js';
import { requirePersonalTeam } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// A person's own finances, kept in their personal team. They are for that person and the
// organization's owners, like everything else there. The organization's teams have none: its
// money is kept in one place, at /finances.

export const load: PageServerLoad = async ({ params }) => {
	return loadFinances(await requirePersonalTeam(params.team));
};

export const actions = financeActions(({ params }) => requirePersonalTeam(params.team ?? ''));
