import { error } from '@sveltejs/kit';
import { fileName } from '#lib/media.js';
import { openVaultFile } from '#lib/server/vault.js';
import type { RequestHandler } from './$types';

// Serves one file from the vault. The bucket itself stays private: the file is passed on from
// here, behind the sign-in guard like every other page.
export const GET: RequestHandler = async ({ params }) => {
	const file = await openVaultFile(params.path);
	if (!file) error(404, 'That file does not exist.');

	const name = encodeURIComponent(fileName(params.path));
	const headers = new Headers({
		'content-type': file.contentType,
		// A kind Studio does not know is only ever downloaded, never shown.
		'content-disposition': `${file.shown ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
		'x-content-type-options': 'nosniff',
		'cache-control': 'private, max-age=0'
	});
	if (file.size) headers.set('content-length', file.size);

	return new Response(file.body, { headers });
};
