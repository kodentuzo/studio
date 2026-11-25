import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactions } from '#lib/server/db/schema.js';
import { listVault, removeFromVault, saveToVault } from '#lib/server/vault.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const listing = await listVault(url.searchParams.get('dir') ?? '');
	if (!listing) error(404, 'That folder does not exist.');

	return listing;
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

		const result = await saveToVault(file, typeof dir === 'string' ? dir : undefined);
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

		if (!(await removeFromVault(path))) {
			return fail(404, { action: 'remove', error: 'That file does not exist.' });
		}

		return { removed: true };
	}
};
