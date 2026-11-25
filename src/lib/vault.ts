import { uploadThrough } from './media.js';

/** The address a file in the vault is opened at. Each part of the path is escaped on its own. */
export function vaultUrl(path: string) {
	return `/vault/raw/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Stores a file in the vault. With `dir` it goes into that folder; without, into this month's.
 */
export function uploadToVault(file: File, dir?: string) {
	return uploadThrough('/vault?/upload', file, dir);
}
