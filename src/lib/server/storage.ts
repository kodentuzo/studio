import { AwsClient } from 'aws4fetch';
import {
	S3_ACCESS_KEY_ID,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_REGION,
	S3_SECRET_ACCESS_KEY
} from '$app/env/private';

// Studio is given one bucket and keeps every file in it. Nothing here knows which storage
// server is behind the address: any S3-style one works.
const client = new AwsClient({
	accessKeyId: S3_ACCESS_KEY_ID,
	secretAccessKey: S3_SECRET_ACCESS_KEY,
	region: S3_REGION,
	service: 's3'
});

const bucketUrl = new URL(`/${encodeURIComponent(S3_BUCKET)}`, S3_ENDPOINT).href;

function objectUrl(key: string) {
	return `${bucketUrl}/${encodeURIComponent(key)}`;
}

/** Makes sure the bucket is there. Run once at start. */
export async function ensureBucket() {
	const head = await client.fetch(bucketUrl, { method: 'HEAD' });
	if (head.ok) return;

	if (head.status !== 404) {
		throw new Error(`The storage bucket could not be reached (status ${head.status}).`);
	}

	const created = await client.fetch(bucketUrl, { method: 'PUT' });
	if (!created.ok) {
		throw new Error(`The storage bucket could not be created (status ${created.status}).`);
	}
}

export async function putObject(key: string, body: Blob, contentType: string) {
	const response = await client.fetch(objectUrl(key), {
		method: 'PUT',
		headers: { 'content-type': contentType },
		body
	});
	if (!response.ok) throw new Error(`Storing the file failed (status ${response.status}).`);
}

/** The stored file as a response to stream on, or null if it is not there. */
export async function getObject(key: string): Promise<Response | null> {
	const response = await client.fetch(objectUrl(key));
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Reading the file failed (status ${response.status}).`);
	return response;
}

export async function deleteObject(key: string) {
	const response = await client.fetch(objectUrl(key), { method: 'DELETE' });
	// Deleting something already gone is fine.
	if (!response.ok && response.status !== 404) {
		throw new Error(`Deleting the file failed (status ${response.status}).`);
	}
}
