/** The address a stored file is opened at. Each part of the path is escaped on its own. */
export function fileUrl(path: string) {
	return `/files/raw/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** The last part of a path: "2026/11/invoice.pdf" gives "invoice.pdf". */
export function fileName(path: string) {
	return path.slice(path.lastIndexOf('/') + 1);
}
