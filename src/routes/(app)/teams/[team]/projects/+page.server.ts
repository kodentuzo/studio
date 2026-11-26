import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { requireTeam } from '#lib/server/teams.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const team = await requireTeam(params.team);
	const rows = await db
		.select()
		.from(projects)
		.where(eq(projects.teamId, team.id))
		.orderBy(asc(projects.name));
	return { projects: rows };
};

export const actions: Actions = {
	create: async ({ request, params }) => {
		const team = await requireTeam(params.team);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = String(form.get('slug') ?? '').trim();

		if (!name) {
			return fail(400, { action: 'create', error: 'Give the project a name.' });
		}
		if (name.length > 45) {
			return fail(400, { action: 'create', error: 'The name can be at most 45 characters.' });
		}
		if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 40) {
			return fail(400, {
				action: 'create',
				error:
					'The slug can have lowercase letters, digits and hyphens, up to 40 characters, and cannot start or end with a hyphen.'
			});
		}

		const [taken] = await db
			.select({ id: projects.id })
			.from(projects)
			.where(and(eq(projects.teamId, team.id), eq(projects.slug, slug)))
			.limit(1);
		if (taken) {
			return fail(409, { action: 'create', error: `The slug "${slug}" is already used.` });
		}

		// Two people creating the same slug at the same instant: the second insert is skipped by
		// the rule that a team's slugs are unique and returns nothing.
		const [created] = await db
			.insert(projects)
			.values({ teamId: team.id, name, slug })
			.onConflictDoNothing({ target: [projects.teamId, projects.slug] })
			.returning({ slug: projects.slug });
		if (!created) {
			return fail(409, { action: 'create', error: `The slug "${slug}" is already used.` });
		}

		return { created: created.slug };
	}
};
