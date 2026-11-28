import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.js';
import { nameProblem, slugProblem } from '#lib/server/organization-plugin.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');
	return {};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = String(form.get('slug') ?? '').trim();
		const refuse = (status: number, error: string) => fail(status, { name, slug, error });

		const problem = nameProblem(name) ?? slugProblem(slug);
		if (problem) return refuse(400, problem);

		// Made through the sign-in library, which also makes the person creating it its owner.
		try {
			await auth.api.createOrganization({ body: { name, slug }, headers: request.headers });
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			if (thrown.body?.code === 'ORGANIZATION_ALREADY_EXISTS') {
				return refuse(409, `The slug "${slug}" is already used.`);
			}
			return refuse(400, thrown.body?.message ?? 'The organization could not be created.');
		}

		redirect(303, `/organizations/${slug}`);
	}
};
