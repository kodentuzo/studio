import { fail } from '@sveltejs/kit';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactions } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select()
		.from(transactions)
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

	return { transactions: rows, totals, opening };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const kind = String(form.get('kind') ?? '');
		const date = String(form.get('date') ?? '');
		const amount = String(form.get('amount') ?? '').trim();
		const counterparty = String(form.get('counterparty') ?? '').trim();
		const note = String(form.get('note') ?? '').trim();
		const status = String(form.get('status') ?? '');

		if (kind !== 'expense' && kind !== 'income') {
			return fail(400, { action: 'add', error: 'Choose expense or income.' });
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
			return fail(400, { action: 'add', error: 'Enter a valid date.' });
		}
		// A positive number with at most two decimals. The sign comes from the kind.
		if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) === 0) {
			return fail(400, { action: 'add', error: 'Enter an amount above zero, such as 7.49.' });
		}
		if (!counterparty) {
			return fail(400, { action: 'add', error: 'Say who was paid, or who paid.' });
		}
		if (status !== 'paid' && status !== 'planned') {
			return fail(400, { action: 'add', error: 'Choose paid or planned.' });
		}

		await db.insert(transactions).values({
			date,
			amount: kind === 'expense' ? `-${amount}` : amount,
			counterparty,
			note: note || null,
			status
		});

		return { added: true };
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
