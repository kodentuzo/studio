import { error } from '@sveltejs/kit';
import { getFile } from '#lib/server/files.js';
import { getObject } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

// Serves one stored file. It sits behind the sign-in guard like every other page.
export const GET: RequestHandler = async ({ params }) => {
	const file = await getFile(params.id);
	if (!file) error(404, 'That file does not exist.');

	const object = await getObject(file.key);
	if (!object) error(404, 'That file is missing from storage.');

	return new Response(object.body, {
		headers: {
			// The type Studio worked out when the file was stored, never one the uploader claimed.
			'content-type': file.contentType,
			'content-length': String(file.size),
			'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, max-age=0'
		}
	});
};
