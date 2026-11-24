import sharp from 'sharp';
import { ICON_MAX_SIDE } from '#lib/project.js';
import { fileInfo } from './files.js';

// Refuse to unpack anything larger than the largest icon Studio accepts. An image is unpacked
// at four bytes per pixel, and a small file can claim to be enormous.
const LIMIT_PIXELS = ICON_MAX_SIDE * ICON_MAX_SIDE;

/**
 * The width and height of a stored image, the way it is displayed (a photo's rotation flag is
 * applied). Null if the file is not there, is not an image, or is too large to open safely.
 */
export async function imageSize(path: string): Promise<{ width: number; height: number } | null> {
	const info = await fileInfo(path);
	if (!info || !info.contentType.startsWith('image/')) return null;

	try {
		const meta = await sharp(info.full, { limitInputPixels: LIMIT_PIXELS }).metadata();
		if (!meta.width || !meta.height) return null;

		// Orientations 5 to 8 mean the picture is stored on its side.
		const sideways = (meta.orientation ?? 1) >= 5;
		return sideways
			? { width: meta.height, height: meta.width }
			: { width: meta.width, height: meta.height };
	} catch {
		return null;
	}
}
