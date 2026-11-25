import { uploadThrough } from './media.js';

/** The address a file in the vault is opened at. Each part of the path is escaped on its own. */
export function vaultUrl(path: string) {
	return `/vault/raw/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Stores a file in the vault through the Finances page, in this month's folder. */
export function uploadToVault(file: File) {
	return uploadThrough('/finances?/upload', file);
}
