import { redirect } from '@sveltejs/kit';
import { findOrganization, findOrganizationOf } from '#lib/server/organizations.js';
import type { PageServerLoad } from './$types';

// Leads on to this Studio's organization. Before Studio has been set up, to the page that does
// that; and for someone who does not belong to the organization, to a page that says so.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');

	const mine = await findOrganizationOf(locals.user.id);
	if (mine) redirect(303, `/organizations/${mine.slug}`);

	redirect(303, (await findOrganization()) ? '/not-a-member' : '/setup');
};
