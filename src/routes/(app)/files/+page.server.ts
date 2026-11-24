import { fail } from '@sveltejs/kit';
import { deleteFile, listFiles, saveFile } from '#lib/server/files.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await listFiles();

	// One entry per file, with every transaction that uses it.
	const byId = new Map<
		string,
		{
			id: string;
			name: string;
			contentType: string;
			size: number;
			createdAt: Date;
			uses: { id: string; date: string; counterparty: string }[];
		}
	>();

	for (const row of rows) {
		let file = byId.get(row.id);
		if (!file) {
			file = {
				id: row.id,
				name: row.name,
				contentType: row.contentType,
				size: row.size,
				createdAt: row.createdAt,
				uses: []
			};
			byId.set(row.id, file);
		}
		if (row.transactionId && row.transactionDate && row.transactionCounterparty) {
			file.uses.push({
				id: row.transactionId,
				date: row.transactionDate,
				counterparty: row.transactionCounterparty
			});
		}
	}

	return { files: [...byId.values()] };
};

export const actions: Actions = {
	// Stores one file. Also used by the transaction sheet, which then attaches it.
	upload: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');

		if (!(file instanceof File)) {
			return fail(400, { action: 'upload', error: 'Choose a file.' });
		}

		const result = await saveFile(file);
		if ('error' in result) return fail(422, { action: 'upload', error: result.error });

		const { id, name, contentType, size } = result.file;
		return { file: { id, name, contentType, size } };
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const result = await deleteFile(String(form.get('id') ?? ''));

		if ('error' in result) return fail(409, { action: 'remove', error: result.error });

		return { removed: true };
	}
};
