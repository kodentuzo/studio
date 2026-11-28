import { error } from '@sveltejs/kit';
import { openDocument } from '#lib/server/documents.js';
import { requireOrganization } from '#lib/server/organizations.js';
import type { RequestHandler } from './$types';

// Serves one transaction document, by its id, to a member of the organization. The file has no
// other address.
export const GET: RequestHandler = async ({ params }) => {
	await requireOrganization();
	const document = await openDocument(params.id);
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
