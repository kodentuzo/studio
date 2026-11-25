/** The address a file in the vault is opened at. Each part of the path is escaped on its own. */
export function vaultUrl(path: string) {
	return `/vault/raw/${path.split('/').map(encodeURIComponent).join('/')}`;
}
