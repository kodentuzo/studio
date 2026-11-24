import { error } from '@sveltejs/kit';
import { fileName } from '#lib/files.js';
import { openFile } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

// Serves one stored file. It sits behind the sign-in guard like every other page.
export const GET: RequestHandler = async ({ params }) => {
	const file = await openFile(params.path);
	if (!file) error(404, 'That file does not exist.');

	return new Response(file.body, {
		headers: {
			// Worked out from the file's own first bytes, never from its name.
			'content-type': file.contentType,
			'content-length': String(file.size),
			'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName(params.path))}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, max-age=0'
		}
	});
};
