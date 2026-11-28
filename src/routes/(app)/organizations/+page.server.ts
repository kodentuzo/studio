import { redirect } from '@sveltejs/kit';
import { listOrganizations } from '#lib/server/organizations.js';
import type { PageServerLoad } from './$types';

// Leads on to the oldest organization the person belongs to. With none, to the form that creates
// one.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');
	const [first] = await listOrganizations(locals.user.id);
	redirect(303, first ? `/organizations/${first.slug}` : '/organizations/new');
};
