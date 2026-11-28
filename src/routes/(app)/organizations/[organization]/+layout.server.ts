import { requireOrganization } from '#lib/server/organizations.js';
import type { LayoutServerLoad } from './$types';

// Every page under /organizations/<slug> is about that organization. One that is unknown, or
// that the person does not belong to, is "not found".
export const load: LayoutServerLoad = async ({ params }) => {
	const organization = await requireOrganization(params.organization);
	return { organization: { slug: organization.slug, name: organization.name } };
};
