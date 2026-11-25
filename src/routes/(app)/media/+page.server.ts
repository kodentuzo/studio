import { error, fail } from '@sveltejs/kit';
import { eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects, transactions } from '#lib/server/db/schema.js';
import { listFolder, removeFile, saveUpload } from '#lib/server/media.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const listing = await listFolder(url.searchParams.get('dir') ?? '');
	if (!listing) error(404, 'That folder does not exist.');

	// Which of these files a transaction points at.
	const paths = listing.files.map((file) => file.path);
	const uses = paths.length
		? await db
				.select({
					id: transactions.id,
					date: transactions.date,
					counterparty: transactions.counterparty,
					filePath: transactions.filePath
				})
				.from(transactions)
				.where(inArray(transactions.filePath, paths))
		: [];

	// And which are a project's icon.
	const icons = paths.length
		? await db
				.select({ slug: projects.slug, name: projects.name, iconPath: projects.iconPath })
				.from(projects)
				.where(inArray(projects.iconPath, paths))
		: [];

	return {
		dir: listing.dir,
		folders: listing.folders,
		files: listing.files.map((file) => ({
			...file,
			uses: uses
				.filter((use) => use.filePath === file.path)
				.map(({ id, date, counterparty }) => ({ id, date, counterparty })),
			iconOf: icons
				.filter((icon) => icon.iconPath === file.path)
				.map(({ slug, name }) => ({ slug, name }))
		}))
	};
};

export const actions: Actions = {
	// Stores one file. With `dir` it goes into that folder; the transaction sheet sends none,
	// and the file goes into this month's folder.
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

		const [use] = await db
			.select({ id: transactions.id })
			.from(transactions)
			.where(eq(transactions.filePath, path))
			.limit(1);
		if (use) {
			return fail(409, {
				action: 'remove',
				error: 'That file is attached to a transaction. Detach it first.'
			});
		}

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
