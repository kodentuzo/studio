import { desc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { files, transactions } from './db/schema.js';
import { deleteObject, putObject } from './storage.js';

const MAX_BYTES = 5 * 1024 * 1024;

/** The kinds of file Studio stores, told apart by their first bytes, not by their name. */
function sniffType(bytes: Uint8Array): string | null {
	const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);

	if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'; // %PDF-
	if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
	if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (
		starts(0x52, 0x49, 0x46, 0x46) && // RIFF
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50 // WEBP
	) {
		return 'image/webp';
	}
	return null;
}

export type StoredFile = typeof files.$inferSelect;

/** Checks a file, puts it in the bucket and records it. */
export async function saveFile(file: File): Promise<{ file: StoredFile } | { error: string }> {
	if (file.size === 0) return { error: 'Choose a file.' };
	if (file.size > MAX_BYTES) return { error: 'That file is larger than 5 MB.' };

	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	const contentType = sniffType(head);
	if (!contentType) return { error: 'Only PDF, PNG, JPEG and WebP files can be stored.' };

	// The key is ours alone: nothing a person typed ends up in a storage path.
	const key = crypto.randomUUID();
	const name = (file.name || 'file').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 200);

	await putObject(key, file, contentType);

	try {
		const [row] = await db
			.insert(files)
			.values({ key, name, contentType, size: file.size })
			.returning();
		return { file: row };
	} catch (error) {
		// Do not leave bytes in the bucket that no row points at.
		await deleteObject(key);
		throw error;
	}
}

export async function getFile(id: string): Promise<StoredFile | null> {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [row] = await db.select().from(files).where(eq(files.id, id));
	return row ?? null;
}

/** Every file, newest first, with the transaction that uses it, if one does. */
export async function listFiles() {
	return db
		.select({
			id: files.id,
			name: files.name,
			contentType: files.contentType,
			size: files.size,
			createdAt: files.createdAt,
			transactionId: transactions.id,
			transactionDate: transactions.date,
			transactionCounterparty: transactions.counterparty
		})
		.from(files)
		.leftJoin(transactions, eq(transactions.fileId, files.id))
		.orderBy(desc(files.createdAt));
}

/** Deletes a file that nothing uses. A file in use is refused. */
export async function deleteFile(id: string): Promise<{ deleted: true } | { error: string }> {
	const file = await getFile(id);
	if (!file) return { error: 'That file does not exist.' };

	const [use] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(eq(transactions.fileId, id))
		.limit(1);
	if (use) return { error: 'That file is attached to a transaction. Detach it first.' };

	// The row first: if this fails, the file is still listed and can be tried again.
	await db.delete(files).where(eq(files.id, id));
	await deleteObject(file.key);

	return { deleted: true };
}
