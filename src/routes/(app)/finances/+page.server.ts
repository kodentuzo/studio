import { fail } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactions } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select()
		.from(transactions)
		.orderBy(desc(transactions.date), desc(transactions.createdAt));

	// Summed in Postgres, where decimals are exact.
	const [totals] = await db
		.select({
			balance: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
			income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0), 0)`,
			expenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} < 0), 0)`
		})
		.from(transactions);

	return { transactions: rows, totals };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const form = await request.formData();
		const kind = String(form.get('kind') ?? '');
		const date = String(form.get('date') ?? '');
		const amount = String(form.get('amount') ?? '').trim();
		const counterparty = String(form.get('counterparty') ?? '').trim();
		const note = String(form.get('note') ?? '').trim();

		if (kind !== 'expense' && kind !== 'income') {
			return fail(400, { error: 'Choose expense or income.' });
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
			return fail(400, { error: 'Enter a valid date.' });
		}
		// A positive number with at most two decimals. The sign comes from the kind.
		if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) === 0) {
			return fail(400, { error: 'Enter an amount above zero, such as 7.49.' });
		}
		if (!counterparty) {
			return fail(400, { error: 'Say who was paid, or who paid.' });
		}

		await db.insert(transactions).values({
			date,
			amount: kind === 'expense' ? `-${amount}` : amount,
			counterparty,
			note: note || null
		});

		return { added: true };
	}
};
