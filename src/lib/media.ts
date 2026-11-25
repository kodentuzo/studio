import { deserialize } from '$app/forms';

/** The address a stored file is opened at. Each part of the path is escaped on its own. */
export function mediaUrl(path: string) {
	return `/media/raw/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** The last part of a path: "2026/11/invoice.pdf" gives "invoice.pdf". */
export function fileName(path: string) {
	return path.slice(path.lastIndexOf('/') + 1);
}

/** Calls one of a page's actions from code and gives back what it returned. */
export async function callAction(url: string, body: FormData) {
	const response = await fetch(url, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
	});
	return deserialize(await response.text());
}

export type UploadedFile = { path: string; name: string; contentType: string };

/** Stores a file through an upload action, such as "?/uploadIcon". */
export async function uploadThrough(
	action: string,
	file: File,
	dir?: string
): Promise<{ file: UploadedFile } | { error: string }> {
	const body = new FormData();
	body.set('file', file);
	if (dir !== undefined) body.set('dir', dir);
	const result = await callAction(action, body);

	if (result.type === 'success' && result.data?.file) {
		return { file: result.data.file as UploadedFile };
	}
	return {
		error:
			result.type === 'failure'
				? String(result.data?.error ?? 'The file could not be stored.')
				: 'The file could not be stored.'
	};
}
