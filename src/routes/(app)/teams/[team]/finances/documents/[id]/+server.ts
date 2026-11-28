import { error } from '@sveltejs/kit';
import { openDocument } from '#lib/server/documents.js';
import { requirePersonalTeam } from '#lib/server/teams.js';
import type { RequestHandler } from './$types';

// Serves one of a person's own transaction documents, by its id, to that person or an owner of
// the organization. The file has no other address.
export const GET: RequestHandler = async ({ params }) => {
	const owner = await requirePersonalTeam(params.team);
	const document = await openDocument(owner, params.id);
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
