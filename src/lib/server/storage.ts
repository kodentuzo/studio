import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { FILES_DIR } from '$app/env/private';

// Files are kept in one folder on disk. The rest of Studio only calls the four functions below,
// so where files live can change without touching anything else.
const root = resolve(FILES_DIR);

/** The place on disk for a key. Refuses anything that would land outside the folder. */
function pathFor(key: string) {
	const path = resolve(root, key);
	if (!path.startsWith(root + sep)) throw new Error('That file path is not allowed.');
	return path;
}

/** Makes sure the folder is there. Run once at start. */
export async function ensureStorage() {
	await mkdir(root, { recursive: true });
}

export async function putObject(key: string, body: Blob) {
	const path = pathFor(key);
	await mkdir(dirname(path), { recursive: true });

	// Written under another name first, so a half-written file is never read.
	const temporary = `${path}.${crypto.randomUUID()}.part`;
	await writeFile(temporary, new Uint8Array(await body.arrayBuffer()));
	await rename(temporary, path);
}

/** The stored file as a response to stream on, or null if it is not there. */
export async function getObject(key: string): Promise<Response | null> {
	const path = pathFor(key);

	try {
		await stat(path);
	} catch {
		return null;
	}

	return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream);
}

export async function deleteObject(key: string) {
	// Deleting something already gone is fine.
	await rm(pathFor(key), { force: true });
}
