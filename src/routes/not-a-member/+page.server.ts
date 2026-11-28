import { redirect } from '@sveltejs/kit';
import { findOrganization, findOrganizationOf } from '#lib/server/organizations.js';
import type { PageServerLoad } from './$types';

// For someone who has an account but does not belong to this Studio's organization: they
// signed up without an invitation, or were removed. Anyone else has no business here.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');
	if (await findOrganizationOf(locals.user.id)) redirect(303, '/');

	const organization = await findOrganization();
	if (!organization) redirect(303, '/setup');

	return { email: locals.user.email, organization: organization.name };
};
