import { error } from '@sveltejs/kit';
import { openDocument } from '#lib/server/documents.js';
import { requireTeam } from '#lib/server/teams.js';
import type { RequestHandler } from './$types';

// Serves one of a team's transaction documents, by its id. It sits behind the sign-in guard like every
// other page: the file has no other address.
export const GET: RequestHandler = async ({ params }) => {
	const document = await openDocument(await requireTeam(params.team), params.id);
	if (!document) error(404, 'That document does not exist.');

	return new Response(document.body, {
		headers: {
			// Worked out from the file's own first bytes, never from its name.
			'content-type': document.contentType,
			'content-length': String(document.size),
			'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, max-age=0'
		}
	});
};
