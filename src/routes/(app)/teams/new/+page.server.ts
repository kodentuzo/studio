import { error, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.js';
import { teamNameProblem, teamSlugProblem } from '#lib/server/organization-plugin.js';
import { managesMembers, requireOrganization } from '#lib/server/organizations.js';
import type { Actions, PageServerLoad } from './$types';

// Where a team is made. That is for the organization's owners and admins.

export const load: PageServerLoad = async () => {
	if (!managesMembers(await requireOrganization())) {
		error(403, 'Only an owner or an admin of the organization can add a team.');
	}
	return {};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const organization = await requireOrganization();
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = String(form.get('slug') ?? '').trim();
		const refuse = (status: number, error: string) => fail(status, { name, slug, error });

		const problem = teamNameProblem(name) ?? teamSlugProblem(slug);
		if (problem) return refuse(400, problem);

		// Made through the sign-in library, which checks that the person may, and that the slug
		// is free. Whoever makes a team is in it from the start.
		try {
			const team = await auth.api.createTeam({
				body: { name, slug, organizationId: organization.id },
				headers: request.headers
			});
			await auth.api.addTeamMember({
				body: { teamId: team.id, userId: locals.user!.id, organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			return refuse(
				thrown.statusCode === 403 ? 403 : 400,
				thrown.body?.message ?? 'The team could not be created.'
			);
		}

		redirect(303, `/teams/${slug}`);
	}
};
