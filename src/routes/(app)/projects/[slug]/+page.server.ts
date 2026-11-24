import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

const COLOR = /^#[0-9a-fA-F]{6}$/;

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db.select().from(projects).where(eq(projects.slug, params.slug));
	if (!project) error(404, 'That project does not exist.');

	return { project };
};

export const actions: Actions = {
	// Saves the branding fields. An emptied optional field is stored as "not set".
	save: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const shortName = String(form.get('shortName') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const themeColor = String(form.get('themeColor') ?? '').trim();
		const backgroundColor = String(form.get('backgroundColor') ?? '').trim();

		const refuse = (message: string) => fail(400, { action: 'save', error: message });

		if (!name) return refuse('Give the project a name.');
		if (name.length > 45) return refuse('The name can be at most 45 characters.');
		if (shortName.length > 12) return refuse('The short name can be at most 12 characters.');
		if (description.length > 300) {
			return refuse('The description can be at most 300 characters.');
		}
		if (themeColor && !COLOR.test(themeColor)) {
			return refuse('The theme colour has to look like #2a78d6.');
		}
		if (backgroundColor && !COLOR.test(backgroundColor)) {
			return refuse('The background colour has to look like #ffffff.');
		}

		const [saved] = await db
			.update(projects)
			.set({
				name,
				shortName: shortName || null,
				description: description || null,
				themeColor: themeColor ? themeColor.toLowerCase() : null,
				backgroundColor: backgroundColor ? backgroundColor.toLowerCase() : null,
				updatedAt: new Date()
			})
			.where(eq(projects.slug, params.slug))
			.returning({ id: projects.id });

		if (!saved) error(404, 'That project does not exist.');

		return { saved: true };
	}
};
