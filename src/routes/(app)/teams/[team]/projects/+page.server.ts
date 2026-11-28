import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { createProject } from '#lib/server/projects.js';
import { requireTeam } from '#lib/server/teams.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const team = await requireTeam(params.team);
	const rows = await db
		.select()
		.from(projects)
		.where(eq(projects.teamId, team.id))
		.orderBy(asc(projects.name));
	return { team: { slug: team.slug, name: team.name }, projects: rows };
};

export const actions: Actions = {
	create: async ({ request, params }) => {
		const team = await requireTeam(params.team);
		return createProject(team, await request.formData());
	}
};
