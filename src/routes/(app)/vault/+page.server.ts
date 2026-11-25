import { error, fail } from '@sveltejs/kit';
import { listVault, removeFromVault, saveToVault } from '#lib/server/vault.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const listing = await listVault(url.searchParams.get('dir') ?? '');
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

		const result = await saveToVault(file, typeof dir === 'string' ? dir : undefined);
		if ('error' in result) return fail(422, { action: 'upload', error: result.error });

		return { file: result };
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const path = String(form.get('path') ?? '');

		if (!(await removeFromVault(path))) {
			return fail(404, { action: 'remove', error: 'That file does not exist.' });
		}

		return { removed: true };
	}
};
