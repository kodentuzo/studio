import { fail } from '@sveltejs/kit';
import { and, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { files, transactions } from '#lib/server/db/schema.js';
import { getFile } from '#lib/server/files.js';
import { getObject } from '#lib/server/storage.js';
import { invoiceReadingEnabled, readInvoice } from '#lib/server/invoice.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ ...getTableColumns(transactions), fileName: files.name })
		.from(transactions)
		.leftJoin(files, eq(files.id, transactions.fileId))
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
		.where(eq(transactions.status, 'paid'));

	const opening = rows.find((row) => row.source === 'opening') ?? null;

	return { transactions: rows, totals, opening, canReadInvoices: invoiceReadingEnabled };
};

/** Checks the fields of the add and edit forms. Returns the row to save, or what is wrong. */
async function readTransaction(form: FormData) {
	const kind = String(form.get('kind') ?? '');
	const date = String(form.get('date') ?? '');
	const amount = String(form.get('amount') ?? '').trim();
	const counterparty = String(form.get('counterparty') ?? '').trim();
	const note = String(form.get('note') ?? '').trim();
	const status = String(form.get('status') ?? '');
	const fileId = String(form.get('fileId') ?? '');

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

	// An attachment is optional. If one is named, it has to be a stored file.
	if (fileId && !(await getFile(fileId))) {
		return { error: 'The attached file does not exist any more. Attach it again.' };
	}

	return {
		values: {
			date,
			amount: kind === 'expense' ? `-${amount}` : amount,
			counterparty,
			note: note || null,
			status,
			fileId: fileId || null
		}
	};
}

export const actions: Actions = {
	add: async ({ request }) => {
		const input = await readTransaction(await request.formData());
		if ('error' in input) return fail(400, { action: 'add', error: input.error });

		await db.insert(transactions).values(input.values);

		return { added: true };
	},

	edit: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'edit', error: 'That transaction does not exist.' });
		}

		const input = await readTransaction(form);
		if ('error' in input) return fail(400, { action: 'edit', error: input.error });

		// The opening balance has its own form, so it is never changed from here.
		await db
			.update(transactions)
			.set(input.values)
			.where(and(eq(transactions.id, id), ne(transactions.source, 'opening')));

		return { edited: true };
	},

	// Reads a stored PDF invoice and returns its fields. Saves nothing: the page fills in the
	// add form with them, and the person checks and saves.
	readInvoice: async ({ request }) => {
		const form = await request.formData();
		const file = await getFile(String(form.get('fileId') ?? ''));

		if (!file) {
			return fail(400, { action: 'readInvoice', error: 'That file does not exist.' });
		}
		if (file.contentType !== 'application/pdf') {
			return fail(422, {
				action: 'readInvoice',
				error: 'Only PDF invoices can be read. Enter this one by hand.'
			});
		}

		const object = await getObject(file.key);
		if (!object) {
			return fail(404, { action: 'readInvoice', error: 'That file is missing from storage.' });
		}

		const result = await readInvoice(new Uint8Array(await object.arrayBuffer()));
		if ('error' in result) {
			return fail(422, { action: 'readInvoice', error: result.error });
		}

		return { invoice: result.fields };
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'remove', error: 'That transaction does not exist.' });
		}

		// The opening balance is removed by setting it to 0 in its own form.
		await db
			.delete(transactions)
			.where(and(eq(transactions.id, id), ne(transactions.source, 'opening')));

		return { removed: true };
	},

	// Turns a planned row into a paid one, once the money has moved.
	markPaid: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		if (!/^[0-9a-f-]{36}$/i.test(id)) {
			return fail(400, { action: 'markPaid', error: 'That transaction does not exist.' });
		}

		await db
			.update(transactions)
			.set({ status: 'paid' })
			.where(and(eq(transactions.id, id), eq(transactions.status, 'planned')));

		return { markedPaid: true };
	},

	// Sets, changes or clears the one opening balance row.
	opening: async ({ request }) => {
		const form = await request.formData();
		const amount = String(form.get('amount') ?? '').trim();

		// May be negative: you can start in debt. Zero means no opening balance.
		if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(amount)) {
			return fail(400, { action: 'opening', error: 'Enter an amount, such as 100 or -25.50.' });
		}

		await db.transaction(async (tx) => {
			await tx.delete(transactions).where(eq(transactions.source, 'opening'));
			if (Number(amount) !== 0) {
				// The opening balance has no date of its own. The column needs one, so it takes
				// the earliest transaction's date, or today. It is never shown.
				const [earliest] = await tx
					.select({ date: sql<string | null>`min(${transactions.date})` })
					.from(transactions)
					.where(ne(transactions.source, 'opening'));

				await tx.insert(transactions).values({
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
