// What Studio accepts as an upload, wherever it is then kept: in the media folder or the vault.

const MAX_BYTES = 5 * 1024 * 1024;

/** The kinds of file Studio stores and serves, told apart by their first bytes. */
export function sniffType(bytes: Uint8Array): string | null {
	const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);

	if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'; // %PDF-
	if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
	if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (
		starts(0x52, 0x49, 0x46, 0x46) && // RIFF
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50 // WEBP
	) {
		return 'image/webp';
	}
	return null;
}

/** Checks an upload's size and kind. Gives back its type, worked out from its first bytes. */
export async function checkUpload(file: File): Promise<{ contentType: string } | { error: string }> {
	if (file.size === 0) return { error: 'Choose a file.' };
	if (file.size > MAX_BYTES) return { error: 'That file is larger than 5 MB.' };

	const contentType = sniffType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
	if (!contentType) return { error: 'Only PDF, PNG, JPEG and WebP files can be stored.' };
	return { contentType };
}

/** A name safe to store a file under: no slashes, no control characters, not hidden. */
export function cleanName(name: string) {
	const cleaned = name
		.normalize('NFC')
		.replace(/[\\/\u0000-\u001f\u007f]/g, '_')
		.replace(/^\.+/, '_')
		.trim()
		.slice(0, 150);
	return cleaned || 'file';
}
