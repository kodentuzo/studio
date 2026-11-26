import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { transactionDocuments } from './db/schema.js';
import { teamMedia, type Team } from './teams.js';
import { checkUpload, cleanName } from './uploads.js';

// The papers that belong to transactions: invoices, receipts and the like. A team's files sit in
// one flat folder inside its part of the media folder, each named after its row's id. That
// folder has no address of its own: a document is only ever opened through the team's Finances,
// by its id.

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

/** Where a document's file is, inside its team's part of the media folder. */
function documentPath(document: { id: string; contentType: string }) {
	return `${FOLDER}/${document.id}.${ENDINGS[document.contentType] ?? 'bin'}`;
}

export type StoredDocument = { id: string; name: string; contentType: string; size: number };

/**
 * Checks an upload and stores it as a document of the team that belongs to no transaction yet.
 * Saving the transaction it was uploaded for is what attaches it.
 */
export async function storeDocument(
	team: Team,
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
	const stored = await teamMedia(team).save(
		new File([file], path.slice(FOLDER.length + 1)),
		FOLDER
	);
	if ('error' in stored) return stored;

	await db.insert(transactionDocuments).values({ ...document, teamId: team.id });
	return document;
}

/** One of the team's documents, or null. */
export async function findDocument(team: Team, id: string) {
	if (!isDocumentId(id)) return null;
	const [document] = await db
		.select()
		.from(transactionDocuments)
		.where(and(eq(transactionDocuments.teamId, team.id), eq(transactionDocuments.id, id)));
	return document ?? null;
}

/** The document's file as a response to stream on, with the name it was uploaded under. */
export async function openDocument(team: Team, id: string) {
	const document = await findDocument(team, id);
	if (!document) return null;
	const file = await teamMedia(team).open(documentPath(document));
	return file ? { ...file, name: document.name } : null;
}

export async function readDocumentBytes(team: Team, document: { id: string; contentType: string }) {
	return teamMedia(team).read(documentPath(document));
}

/**
 * Makes a transaction's documents exactly the ones named: those just uploaded are attached, and
 * any it had that are no longer named are deleted. A document of another transaction or another
 * team is left alone, whatever is named.
 */
export async function setTransactionDocuments(team: Team, transactionId: string, ids: string[]) {
	const wanted = ids.filter(isDocumentId);

	if (wanted.length) {
		await db
			.update(transactionDocuments)
			.set({ transactionId })
			.where(
				and(
					eq(transactionDocuments.teamId, team.id),
					inArray(transactionDocuments.id, wanted),
					isNull(transactionDocuments.transactionId)
				)
			);
	}

	const current = await documentsOf(team, transactionId);
	await removeDocuments(
		team,
		current.filter((document) => !wanted.includes(document.id))
	);
}

/** The documents of one transaction. Read these before deleting it, to delete their files after. */
export async function documentsOf(team: Team, transactionId: string) {
	return db
		.select()
		.from(transactionDocuments)
		.where(
			and(
				eq(transactionDocuments.teamId, team.id),
				eq(transactionDocuments.transactionId, transactionId)
			)
		);
}

/** Deletes documents of the team: their rows, if still there, and their files. */
export async function removeDocuments(team: Team, documents: { id: string; contentType: string }[]) {
	if (documents.length === 0) return;

	await db.delete(transactionDocuments).where(
		and(
			eq(transactionDocuments.teamId, team.id),
			inArray(
				transactionDocuments.id,
				documents.map((document) => document.id)
			)
		)
	);
	const media = teamMedia(team);
	for (const document of documents) {
		await media.remove(documentPath(document));
	}
}

/**
 * Clears out the team's documents uploaded more than a day ago for a transaction that was never
 * saved.
 */
export async function removeStrayDocuments(team: Team) {
	const strays = await db
		.select()
		.from(transactionDocuments)
		.where(
			and(
				eq(transactionDocuments.teamId, team.id),
				isNull(transactionDocuments.transactionId),
				lt(transactionDocuments.createdAt, sql`now() - interval '1 day'`)
			)
		);
	await removeDocuments(team, strays);
}
