import { callAction } from './media.js';

/** A transaction document as the Finances page knows it. */
export type TransactionDocument = { id: string; name: string; contentType: string };

/** The address one of an organization's transaction documents is opened at. */
export function documentUrl(organization: string, id: string) {
	return `/organizations/${organization}/finances/documents/${id}`;
}

/**
 * Stores a file as a document through the Finances page it is called from. It belongs to no
 * transaction until one is saved with it.
 */
export async function uploadDocument(
	file: File
): Promise<{ document: TransactionDocument } | { error: string }> {
	const body = new FormData();
	body.set('file', file);
	const result = await callAction('?/upload', body);

	if (result.type === 'success' && result.data?.document) {
		return { document: result.data.document as TransactionDocument };
	}
	return {
		error:
			result.type === 'failure'
				? String(result.data?.error ?? 'The file could not be stored.')
				: 'The file could not be stored.'
	};
}
