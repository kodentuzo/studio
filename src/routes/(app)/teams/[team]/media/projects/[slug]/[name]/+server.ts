import { error } from '@sveltejs/kit';
import { teamMedia } from '#lib/server/teams.js';
import type { RequestHandler } from './$types';

// Serves one file from a project's folder. This is the only part of the media folder with a
// public address: hooks.server.ts lets it through without a sign-in.
export const GET: RequestHandler = async ({ params }) => {
	const file = await teamMedia({ slug: params.team }).open(
		`projects/${params.slug}/${params.name}`
	);
	if (!file) error(404, 'That file does not exist.');

	return new Response(file.body, {
		headers: {
			// Worked out from the file's own first bytes, never from its name.
			'content-type': file.contentType,
			'content-length': String(file.size),
			'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(params.name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'public, max-age=3600'
		}
	});
};
