import { redirect } from '@sveltejs/kit';
import { listOrganizations } from '#lib/server/organizations.js';
import type { PageServerLoad } from './$types';

// Leads on to the oldest organization. With no organizations at all, to the form that creates the
// first one.
export const load: PageServerLoad = async () => {
	const [first] = await listOrganizations();
	redirect(303, first ? `/organizations/${first.slug}` : '/organizations/new');
};
