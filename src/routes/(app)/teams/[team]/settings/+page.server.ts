import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { teams } from '#lib/server/db/schema.js';
import { requireTeam } from '#lib/server/teams.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const team = await requireTeam(params.team);
	return { settings: { name: team.name, slug: team.slug, createdAt: team.createdAt } };
};

export const actions: Actions = {
	// Saves the General section. Only the name can change: the slug is part of every address and
	// of the team's folder on disk.
	general: async ({ request, params }) => {
		const team = await requireTeam(params.team);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		if (!name) return fail(400, { action: 'general', error: 'Give the team a name.' });
		if (name.length > 45) {
			return fail(400, { action: 'general', error: 'The name can be at most 45 characters.' });
		}

		await db.update(teams).set({ name, updatedAt: new Date() }).where(eq(teams.id, team.id));

		return { action: 'general', saved: true };
	}
};
