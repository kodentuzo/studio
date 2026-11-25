import { AwsClient } from 'aws4fetch';
import { dev } from '$app/env';
import {
	VAULT_S3_ACCESS_KEY_ID,
	VAULT_S3_BUCKET,
	VAULT_S3_ENDPOINT,
	VAULT_S3_REGION,
	VAULT_S3_SECRET_ACCESS_KEY
} from '$app/env/private';

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
