import { desc, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactions } from '#lib/server/db/schema.js';
import type { PageServerLoad } from './$types';

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
