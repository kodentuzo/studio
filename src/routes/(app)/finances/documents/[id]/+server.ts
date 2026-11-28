import { error } from '@sveltejs/kit';
import { openDocument } from '#lib/server/documents.js';
import { requireOrganization } from '#lib/server/organizations.js';
import type { RequestHandler } from './$types';

// Serves one of the organization's transaction documents, by its id, to a member of the
// organization. The file has no other address. A person's own documents are not served here.
export const GET: RequestHandler = async ({ params }) => {
	await requireOrganization();
	const document = await openDocument(null, params.id);
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
