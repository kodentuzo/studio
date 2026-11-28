import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { transactionDocuments } from './db/schema.js';
import {
	documentsOwnedBy,
	ownerId,
	ownerMedia,
	type FinanceOwner
} from './finance-owner.js';
import { checkUpload, cleanName } from './uploads.js';

// The papers that belong to transactions: invoices, receipts and the like. Their files
// sit in one flat folder, each named after its row's id: the organization's inside the media
// folder, a person's inside their personal team's folder. That folder has no address of its
// own: a document is only ever opened through Finances, by its id.
//
// Every function here is told whose finances it is working on, and never touches another's.

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

/** Where a document's file is, inside the media folder. */
function documentPath(document: { id: string; contentType: string }) {
	return `${FOLDER}/${document.id}.${ENDINGS[document.contentType] ?? 'bin'}`;
}

export type StoredDocument = { id: string; name: string; contentType: string; size: number };

/**
 * Checks an upload and stores it as a document that belongs to no transaction
 * yet. Saving the transaction it was uploaded for is what attaches it.
 */
export async function storeDocument(
	owner: FinanceOwner,
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
	const stored = await ownerMedia(owner).save(
		new File([file], path.slice(FOLDER.length + 1)),
		FOLDER
	);
	if ('error' in stored) return stored;

	await db.insert(transactionDocuments).values({ ...document, teamId: ownerId(owner) });
	return document;
}

/** One of the owner's documents, or null. */
export async function findDocument(owner: FinanceOwner, id: string) {
	if (!isDocumentId(id)) return null;
	const [document] = await db
		.select()
		.from(transactionDocuments)
		.where(and(eq(transactionDocuments.id, id), documentsOwnedBy(owner)));
	return document ?? null;
}

/** The document's file as a response to stream on, with the name it was uploaded under. */
export async function openDocument(owner: FinanceOwner, id: string) {
	const document = await findDocument(owner, id);
	if (!document) return null;
	const file = await ownerMedia(owner).open(documentPath(document));
	return file ? { ...file, name: document.name } : null;
}

export async function readDocumentBytes(
	owner: FinanceOwner,
	document: { id: string; contentType: string }
) {
	return ownerMedia(owner).read(documentPath(document));
}

/**
 * Makes a transaction's documents exactly the ones named: those just uploaded are attached, and
 * any it had that are no longer named are deleted. A document of another transaction, or of
 * another owner, is left alone, whatever is named.
 */
export async function setTransactionDocuments(
	owner: FinanceOwner,
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
					inArray(transactionDocuments.id, wanted),
					isNull(transactionDocuments.transactionId),
					documentsOwnedBy(owner)
				)
			);
	}

	const current = await documentsOf(owner, transactionId);
	await removeDocuments(
		owner,
		current.filter((document) => !wanted.includes(document.id))
	);
}

/** The documents of one transaction. Read these before deleting it, to delete their files after. */
export async function documentsOf(owner: FinanceOwner, transactionId: string) {
	return db
		.select()
		.from(transactionDocuments)
		.where(and(eq(transactionDocuments.transactionId, transactionId), documentsOwnedBy(owner)));
}

/** Deletes documents: their rows, if still there, and their files. */
export async function removeDocuments(
	owner: FinanceOwner,
	documents: { id: string; contentType: string }[]
) {
	if (documents.length === 0) return;

	await db.delete(transactionDocuments).where(
		and(
			inArray(
				transactionDocuments.id,
				documents.map((document) => document.id)
			),
			documentsOwnedBy(owner)
		)
	);
	for (const document of documents) {
		await ownerMedia(owner).remove(documentPath(document));
	}
}

/**
 * Clears out the owner's documents uploaded more than a day ago for a transaction that was
 * never saved.
 */
export async function removeStrayDocuments(owner: FinanceOwner) {
	const strays = await db
		.select()
		.from(transactionDocuments)
		.where(
			and(
				isNull(transactionDocuments.transactionId),
				lt(transactionDocuments.createdAt, sql`now() - interval '1 day'`),
				documentsOwnedBy(owner)
			)
		);
	await removeDocuments(owner, strays);
}
