import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { teams } from '#lib/server/db/schema.js';
import { requireTeam, teamMedia } from '#lib/server/teams.js';
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
	},

	// Deletes the team and everything it has. The slug has to be typed, so this cannot happen by
	// a slip of the hand.
	delete: async ({ request, params }) => {
		const team = await requireTeam(params.team);
		const form = await request.formData();
		const typed = String(form.get('slug') ?? '').trim();

		if (typed !== team.slug) {
			return fail(400, {
				action: 'delete',
				error: 'That is not the slug of this team. Nothing was deleted.'
			});
		}

		// The rows first: deleting the team deletes its projects, transactions and documents with
		// it. Then the files, which the database knows nothing about. In this order a failure
		// can leave files nobody points at, never rows pointing at files that are gone.
		await db.delete(teams).where(eq(teams.id, team.id));
		await teamMedia(team).removeAll();

		redirect(303, '/teams');
	}
};
