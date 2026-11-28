import { createReadStream } from 'node:fs';
import {
	lstat,
	mkdir,
	open,
	readdir,
	readFile,
	realpath,
	rename,
	rm,
	rmdir,
	writeFile
} from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { MEDIA_DIR } from '$app/env/private';
import { checkUpload, cleanName, sniffType } from './uploads.js';

// Media files live in one folder on disk, and that folder is the list: whatever is in it is what
// Studio shows. A file is known by its path inside the folder, such as "2026/11/invoice.pdf".
const root = resolve(MEDIA_DIR);

/** Makes sure the folder is there. Run once at start. */
export async function ensureStorage() {
	await mkdir(root, { recursive: true });
}

/**
 * The place on disk for a path, or null if the path is not one Studio allows: outside the
 * folder, hidden (a part starting with a dot), or empty where a file is needed.
 */
function locate(path: string): string | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.some((part) => part.startsWith('.') || part.includes('\\') || part.includes('\0'))) {
		return null;
	}

	const full = resolve(root, ...parts);
	if (full !== root && !full.startsWith(root + sep)) return null;
	return full;
}

/** True if the real location, after following links, is still inside the folder. */
async function isInside(full: string) {
	try {
		const real = await realpath(full);
		const realRoot = await realpath(root);
		return real === realRoot || real.startsWith(realRoot + sep);
	} catch {
		return false;
	}
}

async function sniffFile(full: string): Promise<string | null> {
	const handle = await open(full, 'r');
	try {
		const head = new Uint8Array(12);
		await handle.read(head, 0, 12, 0);
		return sniffType(head);
	} finally {
		await handle.close();
	}
}

export type Listing = {
	/** The folder being listed, "" for the top. */
	dir: string;
	folders: { name: string; path: string }[];
	files: { name: string; path: string; size: number; modified: Date }[];
};

/** What is in a folder. Hidden entries, half-written files and links are left out. */
export async function listFolder(dir: string): Promise<Listing | null> {
	const full = locate(dir);
	if (!full || !(await isInside(full))) return null;

	let entries;
	try {
		entries = await readdir(full, { withFileTypes: true });
	} catch {
		return null;
	}

	const clean = dir.split('/').filter(Boolean).join('/');
	const listing: Listing = { dir: clean, folders: [], files: [] };

	for (const entry of entries) {
		if (entry.name.startsWith('.') || entry.name.endsWith('.part')) continue;
		const path = clean ? `${clean}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			listing.folders.push({ name: entry.name, path });
		} else if (entry.isFile()) {
			const info = await lstat(resolve(full, entry.name));
			listing.files.push({ name: entry.name, path, size: info.size, modified: info.mtime });
		}
	}

	listing.folders.sort((a, b) => a.name.localeCompare(b.name));
	listing.files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
	return listing;
}

/** Size and type of one file, or null if it is not there or not a kind Studio serves. */
export async function fileInfo(path: string) {
	const full = locate(path);
	if (!full || full === root || !(await isInside(full))) return null;

	try {
		const info = await lstat(full);
		if (!info.isFile()) return null;
		const contentType = await sniffFile(full);
		if (!contentType) return null;
		return { full, size: info.size, contentType };
	} catch {
		return null;
	}
}

/** The file as a response to stream on, or null. */
export async function openFile(path: string) {
	const info = await fileInfo(path);
	if (!info) return null;
	return {
		...info,
		body: Readable.toWeb(createReadStream(info.full)) as ReadableStream
	};
}

export async function readFileBytes(path: string): Promise<Uint8Array | null> {
	const info = await fileInfo(path);
	return info ? new Uint8Array(await readFile(info.full)) : null;
}

/**
 * Checks an upload and writes it to disk. Into `dir` when one is given; otherwise into this
 * month's folder, such as 2026/11. A name already taken gets -1, -2 and so on.
 */
export async function saveUpload(
	file: File,
	dir?: string
): Promise<{ path: string; name: string; contentType: string; size: number } | { error: string }> {
	const checked = await checkUpload(file);
	if ('error' in checked) return checked;
	const { contentType } = checked;

	const now = new Date();
	const folder =
		dir ?? `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
	const fullFolder = locate(folder);
	if (!fullFolder) return { error: 'That folder is not allowed.' };
	await mkdir(fullFolder, { recursive: true });
	if (!(await isInside(fullFolder))) return { error: 'That folder is not allowed.' };

	const wanted = cleanName(file.name || 'file');
	const extension = extname(wanted);
	const stem = extension ? wanted.slice(0, -extension.length) : wanted;
	const bytes = new Uint8Array(await file.arrayBuffer());

	// 'wx' fails if the name is taken, so two uploads can never overwrite each other.
	for (let attempt = 0; attempt < 1000; attempt++) {
		const name = attempt === 0 ? wanted : `${stem}-${attempt}${extension}`;
		const full = resolve(fullFolder, name);
		try {
			const temporary = `${full}.${crypto.randomUUID()}.part`;
			await writeFile(temporary, bytes);
			try {
				const handle = await open(full, 'wx');
				await handle.close();
			} catch (error) {
				await rm(temporary, { force: true });
				throw error;
			}
			await rename(temporary, full);
			const path = relative(root, full).split(sep).join('/');
			return { path, name, contentType, size: file.size };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
	}

	return { error: 'Too many files share that name in this folder.' };
}

/** Deletes one file, and any folders it leaves empty. Whether it is in use is the caller's check. */
export async function removeFile(path: string): Promise<boolean> {
	const full = locate(path);
	if (!full || full === root || !(await isInside(full))) return false;

	try {
		if (!(await lstat(full)).isFile()) return false;
	} catch {
		return false;
	}

	await rm(full);

	// Tidy up: remove folders that are now empty, stopping at the top or the first one in use.
	let folder = dirname(full);
	while (folder !== root && folder.startsWith(root + sep)) {
		try {
			await rmdir(folder);
		} catch {
			break;
		}
		folder = dirname(folder);
	}

	return true;
}

/**
 * Deletes a folder and everything in it. Refuses the media folder itself, and anything that is
 * not a folder inside it. True also when the folder was never there: the outcome is the same.
 */
export async function removeFolder(path: string): Promise<boolean> {
	const full = locate(path);
	if (!full || full === root) return false;

	try {
		if (!(await lstat(full)).isDirectory()) return false;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'ENOENT';
	}
	if (!(await isInside(full))) return false;

	await rm(full, { recursive: true });
	return true;
}

/**
 * The media folder as the rest of Studio uses it. Paths are from the top of the folder, such as
 * "projects/blog/icon.png", and that is also how they are stored in the database.
 */
export const media = {
	info: fileInfo,
	open: openFile,
	read: readFileBytes,
	remove: removeFile,
	save: saveUpload
};
