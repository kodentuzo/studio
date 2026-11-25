import { AwsClient } from 'aws4fetch';
import { dev } from '$app/env';
import {
	VAULT_S3_ACCESS_KEY_ID,
	VAULT_S3_BUCKET,
	VAULT_S3_ENDPOINT,
	VAULT_S3_REGION,
	VAULT_S3_SECRET_ACCESS_KEY
} from '$app/env/private';
import { checkUpload, cleanName } from './uploads.js';

// The vault is one bucket on an S3-style server, and that bucket is the list: whatever is in it
// is what Studio shows. A file is known by its key, such as "2026/11/invoice-3f9a2c1b.pdf".
//
// Nothing here knows which server is behind the address. Only the calls every S3-style server
// has are used: put, get, head, delete and list, with the bucket named in the path.

const client = new AwsClient({
	accessKeyId: VAULT_S3_ACCESS_KEY_ID,
	secretAccessKey: VAULT_S3_SECRET_ACCESS_KEY,
	region: VAULT_S3_REGION,
	service: 's3'
});

const bucket = VAULT_S3_BUCKET;
const bucketUrl = new URL(`/${encodeURIComponent(bucket)}`, VAULT_S3_ENDPOINT).href;

function send(url: string, init?: RequestInit) {
	return client.fetch(url, init);
}

/** The address of one object. Each part of the key is escaped on its own. */
function objectUrl(key: string) {
	return `${bucketUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Checks that the bucket can be reached with the keys given. Run once at start, so a wrong
 * setting stops Studio there instead of failing later on the first upload.
 *
 * The bucket is not created: how that is done differs from one provider to the next. The one
 * exception is development, where the storage server in compose.yaml starts out empty.
 */
export async function ensureVault() {
	let head: Response;
	try {
		head = await send(bucketUrl, { method: 'HEAD' });
	} catch {
		throw new Error(`The vault could not be reached at ${VAULT_S3_ENDPOINT}.`);
	}
	if (head.ok) return;

	if (head.status === 404) {
		if (dev) {
			const created = await send(bucketUrl, { method: 'PUT' });
			if (created.ok) return;
		}
		throw new Error(`The vault bucket "${bucket}" does not exist. Create it, then start again.`);
	}

	if (head.status === 401 || head.status === 403) {
		throw new Error(
			`The vault refused the keys for the bucket "${bucket}" (status ${head.status}). Check VAULT_S3_ACCESS_KEY_ID and VAULT_S3_SECRET_ACCESS_KEY.`
		);
	}

	throw new Error(`The vault bucket "${bucket}" could not be checked (status ${head.status}).`);
}

/** Stores an object. A key already in use is overwritten, so callers pick keys that are new. */
export async function putObject(key: string, body: Uint8Array | Blob, contentType: string) {
	const response = await send(objectUrl(key), {
		method: 'PUT',
		headers: { 'content-type': contentType },
		body: body as BodyInit
	});
	if (!response.ok) throw new Error(`Storing the file failed (status ${response.status}).`);
}

/** Size and type of one object, or null if it is not there. */
export async function headObject(key: string) {
	const response = await send(objectUrl(key), { method: 'HEAD' });
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Checking the file failed (status ${response.status}).`);
	return {
		size: Number(response.headers.get('content-length') ?? 0),
		contentType: response.headers.get('content-type') ?? 'application/octet-stream'
	};
}

/** The stored object as a response to stream on, or null if it is not there. */
export async function getObject(key: string): Promise<Response | null> {
	const response = await send(objectUrl(key));
	if (response.status === 404) {
		await response.body?.cancel();
		return null;
	}
	if (!response.ok) throw new Error(`Reading the file failed (status ${response.status}).`);
	return response;
}

export async function deleteObject(key: string) {
	const response = await send(objectUrl(key), { method: 'DELETE' });
	// Deleting something already gone is fine.
	if (!response.ok && response.status !== 404) {
		throw new Error(`Deleting the file failed (status ${response.status}).`);
	}
}

export type ObjectListing = {
	/** The prefixes one level down, each ending in a slash: "2026/11/". */
	folders: string[];
	files: { key: string; size: number; modified: Date }[];
};

/**
 * What is directly under a prefix: "" for the top, or one ending in a slash such as "2026/".
 * The server answers a thousand entries at a time, so this asks until it has them all.
 */
export async function listObjects(prefix: string): Promise<ObjectListing> {
	const listing: ObjectListing = { folders: [], files: [] };
	let token: string | undefined;

	do {
		const url = new URL(bucketUrl);
		url.searchParams.set('list-type', '2');
		url.searchParams.set('delimiter', '/');
		if (prefix) url.searchParams.set('prefix', prefix);
		if (token) url.searchParams.set('continuation-token', token);

		const response = await send(url.href);
		if (!response.ok) throw new Error(`Listing the vault failed (status ${response.status}).`);
		const xml = await response.text();

		for (const block of blocks(xml, 'CommonPrefixes')) {
			const folder = text(block, 'Prefix');
			if (folder) listing.folders.push(folder);
		}
		for (const block of blocks(xml, 'Contents')) {
			const key = text(block, 'Key');
			// Some servers list the prefix itself as an empty object. That is the folder, not a file.
			if (!key || key === prefix) continue;
			listing.files.push({
				key,
				size: Number(text(block, 'Size') ?? 0),
				modified: new Date(text(block, 'LastModified') ?? 0)
			});
		}

		token =
			text(xml, 'IsTruncated') === 'true' ? (text(xml, 'NextContinuationToken') ?? '') : '';
	} while (token);

	return listing;
}

// The list answer is XML of one fixed, flat shape, so it is read with patterns, not a parser.

function blocks(xml: string, tag: string) {
	return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(
		(match) => match[1]
	);
}

function text(xml: string, tag: string): string | null {
	const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
	return match ? unescapeXml(match[1]) : null;
}

function unescapeXml(value: string) {
	return value
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

// What follows is the vault as the rest of Studio sees it: folders and files, known by path.

/** The kinds the vault shows in the browser. Anything else it only hands over as a download. */
const SHOWN_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

/**
 * A path as the vault allows it, with stray slashes dropped, or null: a part that is hidden
 * (starts with a dot) or holds a backslash or a control character is refused.
 */
function cleanPath(path: string): string | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.some((part) => part.startsWith('.') || /[\\\u0000-\u001f\u007f]/.test(part))) {
		return null;
	}
	return parts.join('/');
}

export type VaultListing = {
	/** The folder being listed, "" for the top. */
	dir: string;
	folders: { name: string; path: string }[];
	files: { name: string; path: string; size: number; modified: Date }[];
};

/** What is in a folder. A folder exists only while it holds something, so none is ever missing. */
export async function listVault(dir: string): Promise<VaultListing | null> {
	const clean = cleanPath(dir);
	if (clean === null) return null;

	const prefix = clean ? `${clean}/` : '';
	const { folders, files } = await listObjects(prefix);

	return {
		dir: clean,
		folders: folders
			.map((folder) => ({
				name: folder.slice(prefix.length, -1),
				path: folder.slice(0, -1)
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		files: files
			.map((file) => ({
				name: file.key.slice(prefix.length),
				path: file.key,
				size: file.size,
				modified: file.modified
			}))
			.sort((a, b) => b.modified.getTime() - a.modified.getTime())
	};
}

/** Size and type of one file, or null if it is not there. */
export async function vaultFileInfo(path: string) {
	const clean = cleanPath(path);
	if (!clean) return null;
	return headObject(clean);
}

/**
 * The file as a response to stream on, or null. `shown` says whether it is a kind the browser
 * may display; the bucket can hold files that did not come through Studio.
 */
export async function openVaultFile(path: string) {
	const clean = cleanPath(path);
	if (!clean) return null;

	const response = await getObject(clean);
	if (!response?.body) return null;

	const contentType = response.headers.get('content-type') ?? '';
	const shown = SHOWN_TYPES.has(contentType);
	return {
		body: response.body,
		size: response.headers.get('content-length'),
		contentType: shown ? contentType : 'application/octet-stream',
		shown
	};
}

export async function readVaultBytes(path: string): Promise<Uint8Array | null> {
	const clean = cleanPath(path);
	if (!clean) return null;
	const response = await getObject(clean);
	return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

/**
 * Checks an upload and stores it. Into `dir` when one is given; otherwise into this month's
 * folder, such as 2026/11. The name gets a random ending, as in invoice-3f9a2c1b.pdf, so two
 * uploads never share a path and nothing is ever overwritten.
 */
export async function saveToVault(
	file: File,
	dir?: string
): Promise<{ path: string; name: string; contentType: string; size: number } | { error: string }> {
	const checked = await checkUpload(file);
	if ('error' in checked) return checked;

	const now = new Date();
	const folder = cleanPath(
		dir ?? `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
	);
	if (folder === null) return { error: 'That folder is not allowed.' };

	const wanted = cleanName(file.name || 'file');
	const dot = wanted.lastIndexOf('.');
	const stem = dot > 0 ? wanted.slice(0, dot) : wanted;
	const extension = dot > 0 ? wanted.slice(dot) : '';
	const name = `${stem}-${crypto.randomUUID().slice(0, 8)}${extension}`;
	const path = folder ? `${folder}/${name}` : name;

	await putObject(path, new Uint8Array(await file.arrayBuffer()), checked.contentType);
	return { path, name, contentType: checked.contentType, size: file.size };
}

/** Deletes one file. Whether it is in use is the caller's check. */
export async function removeFromVault(path: string): Promise<boolean> {
	const clean = cleanPath(path);
	if (!clean || !(await headObject(clean))) return false;
	await deleteObject(clean);
	return true;
}
