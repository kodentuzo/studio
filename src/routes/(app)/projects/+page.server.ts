import { fail } from '@sveltejs/kit';
import { asc, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { managesMembers, requireOrganization } from '#lib/server/organizations.js';
import { createProject } from '#lib/server/projects.js';
import { listTeamsOf, requireTeam } from '#lib/server/teams.js';
import type { Actions, PageServerLoad } from './$types';

// The organization's projects: every project in the teams the person sees, team by team. A
// person's own projects are not among them; those are in their personal space.

export const load: PageServerLoad = async ({ locals }) => {
	const organization = await requireOrganization();
	const teams = await listTeamsOf(locals.user!.id, managesMembers(organization));

	const rows = teams.length
		? await db
				.select()
				.from(projects)
				.where(
					inArray(
						projects.teamId,
						teams.map((team) => team.id)
					)
				)
				.orderBy(asc(projects.name))
		: [];

	return {
		// Every team is listed, also one with no projects yet: that is where one can be made.
		groups: teams.map((team) => ({
			team: { slug: team.slug, name: team.name },
			projects: rows.filter((project) => project.teamId === team.id)
		})),
		canManageTeams: managesMembers(organization)
	};
};

export const actions: Actions = {
	// Makes a project in the team chosen in the form.
	create: async ({ request }) => {
		const form = await request.formData();
		// requireTeam refuses a team the person does not see, exactly like one that does not exist.
		const team = await requireTeam(String(form.get('team') ?? ''));
		// A personal team's projects are made in that person's own space, not here.
		if (team.personalUserId) {
			return fail(400, { action: 'create', error: 'Choose one of the teams.' });
		}
		return createProject(team, form);
	}
};
