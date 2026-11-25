import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { listFolder, removeFile, saveUpload } from '#lib/server/media.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const listing = await listFolder(url.searchParams.get('dir') ?? '');
	if (!listing) error(404, 'That folder does not exist.');

	return listing;
};

export const actions: Actions = {
	// Stores one file. With `dir` it goes into that folder; without, into this month's.
	upload: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');
		const dir = form.get('dir');

		if (!(file instanceof File)) {
			return fail(400, { action: 'upload', error: 'Choose a file.' });
		}

		const result = await saveUpload(file, typeof dir === 'string' ? dir : undefined);
		if ('error' in result) return fail(422, { action: 'upload', error: result.error });

		return { file: result };
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const path = String(form.get('path') ?? '');

		const [icon] = await db
			.select({ name: projects.name })
			.from(projects)
			.where(eq(projects.iconPath, path))
			.limit(1);
		if (icon) {
			return fail(409, {
				action: 'remove',
				error: `That file is the icon of ${icon.name}. Remove it there first.`
			});
		}

		if (!(await removeFile(path))) {
			return fail(404, { action: 'remove', error: 'That file does not exist.' });
		}

		return { removed: true };
	}
};
