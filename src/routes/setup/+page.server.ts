import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { suggestSlug } from '#lib/slug.js';
import { auth } from '#lib/server/auth.js';
import { nameProblem } from '#lib/server/organization-plugin.js';
import { findOrganization } from '#lib/server/organizations.js';
import type { Actions, PageServerLoad } from './$types';

// Where a new Studio is set up: the first person to sign in names the organization it belongs
// to and becomes its owner. Once that is done this page has no further use and leads away.

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');
	if (await findOrganization()) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const refuse = (status: number, error: string) => fail(status, { name, error });

		const problem = nameProblem(name);
		if (problem) return refuse(400, problem);

		// The slug is worked out from the name. A name with no letters or digits gets a plain one.
		const slug = suggestSlug(name) || 'organization';

		// Made through the sign-in library, which makes the person its owner, and which refuses
		// once an organization exists.
		try {
			await auth.api.createOrganization({ body: { name, slug }, headers: request.headers });
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			if (await findOrganization()) return refuse(409, 'This Studio has already been set up.');
			return refuse(400, thrown.body?.message ?? 'The organization could not be created.');
		}

		redirect(303, '/');
	}
};
