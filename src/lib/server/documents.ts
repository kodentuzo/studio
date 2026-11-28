import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { transactionDocuments } from './db/schema.js';
import { organizationMedia, type Organization } from './organizations.js';
import { checkUpload, cleanName } from './uploads.js';

// The papers that belong to transactions: invoices, receipts and the like. An organization's files
// sit in one flat folder inside its part of the media folder, each named after its row's id. That
// folder has no address of its own: a document is only ever opened through the organization's
// Finances, by its id.

const FOLDER = 'finances';

const ENDINGS: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp'
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for something shaped like a document's id. */
export function isDocumentId(value: string) {
	return ID.test(value);
}

/** Where a document's file is, inside its organization's part of the media folder. */
function documentPath(document: { id: string; contentType: string }) {
	return `${FOLDER}/${document.id}.${ENDINGS[document.contentType] ?? 'bin'}`;
}

export type StoredDocument = { id: string; name: string; contentType: string; size: number };

/**
 * Checks an upload and stores it as a document of the organization that belongs to no transaction
 * yet. Saving the transaction it was uploaded for is what attaches it.
 */
export async function storeDocument(
	organization: Organization,
	file: File
): Promise<StoredDocument | { error: string }> {
	const checked = await checkUpload(file);
	if ('error' in checked) return checked;

	const document = {
		id: crypto.randomUUID(),
		name: cleanName(file.name || 'file'),
		contentType: checked.contentType,
		size: file.size
	};

	const path = documentPath(document);
	const stored = await organizationMedia(organization).save(
		new File([file], path.slice(FOLDER.length + 1)),
		FOLDER
	);
	if ('error' in stored) return stored;

	await db.insert(transactionDocuments).values({ ...document, organizationId: organization.id });
	return document;
}

/** One of the organization's documents, or null. */
export async function findDocument(organization: Organization, id: string) {
	if (!isDocumentId(id)) return null;
	const [document] = await db
		.select()
		.from(transactionDocuments)
		.where(
			and(eq(transactionDocuments.organizationId, organization.id), eq(transactionDocuments.id, id))
		);
	return document ?? null;
}

/** The document's file as a response to stream on, with the name it was uploaded under. */
export async function openDocument(organization: Organization, id: string) {
	const document = await findDocument(organization, id);
	if (!document) return null;
	const file = await organizationMedia(organization).open(documentPath(document));
	return file ? { ...file, name: document.name } : null;
}

export async function readDocumentBytes(
	organization: Organization,
	document: { id: string; contentType: string }
) {
	return organizationMedia(organization).read(documentPath(document));
}

/**
 * Makes a transaction's documents exactly the ones named: those just uploaded are attached, and
 * any it had that are no longer named are deleted. A document of another transaction or another
 * organization is left alone, whatever is named.
 */
export async function setTransactionDocuments(
	organization: Organization,
	transactionId: string,
	ids: string[]
) {
	const wanted = ids.filter(isDocumentId);

	if (wanted.length) {
		await db
			.update(transactionDocuments)
			.set({ transactionId })
			.where(
				and(
					eq(transactionDocuments.organizationId, organization.id),
					inArray(transactionDocuments.id, wanted),
					isNull(transactionDocuments.transactionId)
				)
			);
	}

	const current = await documentsOf(organization, transactionId);
	await removeDocuments(
		organization,
		current.filter((document) => !wanted.includes(document.id))
	);
}

/** The documents of one transaction. Read these before deleting it, to delete their files after. */
export async function documentsOf(organization: Organization, transactionId: string) {
	return db
		.select()
		.from(transactionDocuments)
		.where(
			and(
				eq(transactionDocuments.organizationId, organization.id),
				eq(transactionDocuments.transactionId, transactionId)
			)
		);
}

/** Deletes documents of the organization: their rows, if still there, and their files. */
export async function removeDocuments(organization: Organization, documents: { id: string; contentType: string }[]) {
	if (documents.length === 0) return;

	await db.delete(transactionDocuments).where(
		and(
			eq(transactionDocuments.organizationId, organization.id),
			inArray(
				transactionDocuments.id,
				documents.map((document) => document.id)
			)
		)
	);
	const media = organizationMedia(organization);
	for (const document of documents) {
		await media.remove(documentPath(document));
	}
}

/**
 * Clears out the organization's documents uploaded more than a day ago for a transaction that was
 * never saved.
 */
export async function removeStrayDocuments(organization: Organization) {
	const strays = await db
		.select()
		.from(transactionDocuments)
		.where(
			and(
				eq(transactionDocuments.organizationId, organization.id),
				isNull(transactionDocuments.transactionId),
				lt(transactionDocuments.createdAt, sql`now() - interval '1 day'`)
			)
		);
	await removeDocuments(organization, strays);
}
