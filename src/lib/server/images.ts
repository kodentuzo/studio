import sharp from 'sharp';
import { ICON_MAX_SIDE } from '#lib/project.js';
import { fileInfo } from './media.js';

// Refuse to unpack anything larger than the largest icon Studio accepts. An image is unpacked
// at four bytes per pixel, and a small file can claim to be enormous. This guards every place
// that reads pixels. Reading only the size (below) never unpacks anything.
const LIMIT_PIXELS = ICON_MAX_SIDE * ICON_MAX_SIDE;

/**
 * The width and height of a stored image, the way it is displayed (a photo's rotation flag is
 * applied). Null if the file is not there or is not an image.
 *
 * Only the file's header is read, so this is safe on an image of any claimed size: that is how
 * a too-large image gets reported as too large, with its size, and not as unreadable.
 */
export async function imageSize(path: string): Promise<{ width: number; height: number } | null> {
	const info = await fileInfo(path);
	if (!info || !info.contentType.startsWith('image/')) return null;

	try {
		const meta = await sharp(info.full, { limitInputPixels: false }).metadata();
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

/**
 * The largest square that fits in a stored image, as PNG bytes. `offset` says where along the
 * long side the square sits: 0 is the left or top end, 0.5 the centre, 1 the right or bottom end.
 * Null if the image cannot be read.
 */
export async function cropToSquare(
	path: string,
	offset: number
): Promise<Uint8Array<ArrayBuffer> | null> {
	const info = await fileInfo(path);
	const size = await imageSize(path);
	if (!info || !size) return null;

	const side = Math.min(size.width, size.height);
	const spare = Math.max(size.width, size.height) - side;
	const shift = Math.round(spare * Math.min(1, Math.max(0, offset)));

	try {
		// rotate() with no angle turns a sideways photo upright first, so the square is cut from
		// the picture as it is displayed.
		const cropped = await sharp(info.full, { limitInputPixels: LIMIT_PIXELS })
			.rotate()
			.extract({
				left: size.width > size.height ? shift : 0,
				top: size.height > size.width ? shift : 0,
				width: side,
				height: side
			})
			.png()
			.toBuffer();
		return new Uint8Array(cropped);
	} catch {
		return null;
	}
}
