import { fail } from '@sveltejs/kit';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactionDocuments, transactions } from '#lib/server/db/schema.js';
import {
	documentsOf,
	findDocument,
	isDocumentId,
	readDocumentBytes,
	removeDocuments,
	removeStrayDocuments,
	setTransactionDocuments,
	storeDocument
} from '#lib/server/documents.js';
import { invoiceReadingEnabled, readInvoice } from '#lib/server/invoice.js';
import {
	documentsOwnedBy,
	ownerId,
	transactionsOf,
	type FinanceOwner
} from '#lib/server/finance-owner.js';
import { requireOrganization } from '#lib/server/organizations.js';
import type { Actions, PageServerLoad } from './$types';

// These are the organization's finances. A person's own are kept apart: see finance-owner.ts.
const owner: FinanceOwner = null;

export const load: PageServerLoad = async () => {
	await requireOrganization();
	const rows = await db
		.select()
		.from(transactions)
		.where(transactionsOf(owner))
		// Newest first, and the opening balance always last: it comes before everything.
		.orderBy(
			sql`${transactions.source} = 'opening'`,
			desc(transactions.date),
			desc(transactions.createdAt)
		);

	// Summed in Postgres, where decimals are exact. Only paid rows count: planned ones have not
	// happened yet. The opening balance counts toward the balance, but it is neither income nor
	// an expense.
	const [totals] = await db
		.select({
			balance: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
			income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0 and ${transactions.source} <> 'opening'), 0)`,
			expenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} < 0 and ${transactions.source} <> 'opening'), 0)`
		})
		.from(transactions)
		.where(and(eq(transactions.status, 'paid'), transactionsOf(owner)));

	// Each transaction's documents, oldest first.
	const documents = await db
		.select({
			id: transactionDocuments.id,
			transactionId: transactionDocuments.transactionId,
			name: transactionDocuments.name,
			contentType: transactionDocuments.contentType
		})
		.from(transactionDocuments)
		.where(and(isNotNull(transactionDocuments.transactionId), documentsOwnedBy(owner)))
		.orderBy(transactionDocuments.createdAt);

	const opening = rows.find((row) => row.source === 'opening') ?? null;

	return {
		transactions: rows.map((row) => ({
			...row,
			documents: documents
				.filter((document) => document.transactionId === row.id)
				.map(({ id, name, contentType }) => ({ id, name, contentType }))
		})),
		totals,
		opening,
		canReadInvoices: invoiceReadingEnabled
	};
};

// More than anyone attaches by hand; it only stops a form from naming thousands.
const MAX_DOCUMENTS = 20;

/**
 * Checks the fields of the add and edit forms. Returns the row to save and the ids of the
 * documents it should have, or what is wrong.
 */
function readTransaction(form: FormData) {
	const kind = String(form.get('kind') ?? '');
	const date = String(form.get('date') ?? '');
	const amount = String(form.get('amount') ?? '').trim();
	const counterparty = String(form.get('counterparty') ?? '').trim();
	const note = String(form.get('note') ?? '').trim();
	const status = String(form.get('status') ?? '');
	const documentIds = form.getAll('documentId').map(String);

	if (kind !== 'expense' && kind !== 'income') {
		return { error: 'Choose expense or income.' };
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
		return { error: 'Enter a valid date.' };
	}
	// A positive number with at most two decimals. The sign comes from the kind.
	if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) === 0) {
		return { error: 'Enter an amount above zero, such as 7.49.' };
	}
	if (!counterparty) {
		return { error: 'Say who was paid, or who paid.' };
	}
	if (status !== 'paid' && status !== 'planned') {
		return { error: 'Choose paid or planned.' };
	}

	if (documentIds.length > MAX_DOCUMENTS || !documentIds.every(isDocumentId)) {
		return { error: `A transaction can have at most ${MAX_DOCUMENTS} documents.` };
	}

	return {
		values: {
			date,
			amount: kind === 'expense' ? `-${amount}` : amount,
			counterparty,
			note: note || null,
			status
		},
		documentIds
	};
}

export const actions: Actions = {
	// Stores an invoice, a receipt or another paper as a document. Saves no transaction: the
	// document is attached when the transaction in the form is saved.
	upload: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const file = form.get('file');

		if (!(file instanceof File)) {
			return fail(400, { action: 'upload', error: 'Choose a file.' });
		}

		// A good moment to clear out documents whose transaction was never saved.
		await removeStrayDocuments(owner);

		const result = await storeDocument(owner, file);
		if ('error' in result) return fail(422, { action: 'upload', error: result.error });

		return { document: result };
	},

	add: async ({ request }) => {
		await requireOrganization();
		const input = readTransaction(await request.formData());
		if ('error' in input) return fail(400, { action: 'add', error: input.error });

		const [added] = await db
			.insert(transactions)
			.values({ ...input.values, teamId: ownerId(owner) })
			.returning({ id: transactions.id });
		await setTransactionDocuments(owner, added.id, input.documentIds);

		return { added: true };
	},

	edit: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'edit', error: 'That transaction does not exist.' });
		}

		const input = readTransaction(form);
		if ('error' in input) return fail(400, { action: 'edit', error: input.error });

		// The opening balance has its own form, so it is never changed from here.
		const [edited] = await db
			.update(transactions)
			.set(input.values)
			.where(
				and(eq(transactions.id, id), ne(transactions.source, 'opening'), transactionsOf(owner))
			)
			.returning({ id: transactions.id });
		if (edited) await setTransactionDocuments(owner, edited.id, input.documentIds);

		return { edited: true };
	},

	// Reads a stored PDF document as an invoice and returns its fields. Saves nothing: the page fills in the
	// add form with them, and the person checks and saves.
	readInvoice: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const document = await findDocument(owner, String(form.get('documentId') ?? ''));
		if (!document) {
			return fail(400, { action: 'readInvoice', error: 'That file does not exist.' });
		}
		if (document.contentType !== 'application/pdf') {
			return fail(422, {
				action: 'readInvoice',
				error: 'Only PDF invoices can be read. Enter this one by hand.'
			});
		}

		const bytes = await readDocumentBytes(owner, document);
		if (!bytes) {
			return fail(404, { action: 'readInvoice', error: 'That file does not exist.' });
		}

		const result = await readInvoice(bytes);
		if ('error' in result) {
			return fail(422, { action: 'readInvoice', error: result.error });
		}

		return { invoice: result.fields };
	},

	remove: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'remove', error: 'That transaction does not exist.' });
		}

		// Its documents go with it: the rows by themselves, the files here.
		const documents = await documentsOf(owner, id);

		// The opening balance is removed by setting it to 0 in its own form.
		const [removed] = await db
			.delete(transactions)
			.where(
				and(eq(transactions.id, id), ne(transactions.source, 'opening'), transactionsOf(owner))
			)
			.returning({ id: transactions.id });
		if (removed) await removeDocuments(owner, documents);

		return { removed: true };
	},

	// Turns a planned row into a paid one, once the money has moved.
	markPaid: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'markPaid', error: 'That transaction does not exist.' });
		}

		await db
			.update(transactions)
			.set({ status: 'paid' })
			.where(
				and(eq(transactions.id, id), eq(transactions.status, 'planned'), transactionsOf(owner))
			);

		return { markedPaid: true };
	},

	// Sets, changes or clears the one opening balance row.
	opening: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const amount = String(form.get('amount') ?? '').trim();

		// May be negative: you can start in debt. Zero means no opening balance.
		if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(amount)) {
			return fail(400, { action: 'opening', error: 'Enter an amount, such as 100 or -25.50.' });
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(transactions)
				.where(and(eq(transactions.source, 'opening'), transactionsOf(owner)));
			if (Number(amount) !== 0) {
				// The opening balance has no date of its own. The column needs one, so it takes
				// the earliest transaction's date, or today. It is never shown.
				const [earliest] = await tx
					.select({ date: sql<string | null>`min(${transactions.date})` })
					.from(transactions)
					.where(and(ne(transactions.source, 'opening'), transactionsOf(owner)));

				await tx.insert(transactions).values({
					teamId: ownerId(owner),
					date: earliest?.date ?? new Date().toISOString().slice(0, 10),
					amount,
					counterparty: 'Opening balance',
					source: 'opening'
				});
			}
		});

		return { opening: true };
	}
};
