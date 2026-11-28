import { financeActions, loadFinances } from '#lib/server/finances.js';
import { requireOrganization } from '#lib/server/organizations.js';
import type { PageServerLoad } from './$types';

// The organization's finances, for its members. A person's own are at their personal team.

export const load: PageServerLoad = async () => {
	await requireOrganization();
	return loadFinances(null);
};

export const actions = financeActions(async () => {
	await requireOrganization();
	return null;
});
