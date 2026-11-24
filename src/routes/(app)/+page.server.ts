import { and, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { transactions } from '#lib/server/db/schema.js';
import type { PageServerLoad } from './$types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const load: PageServerLoad = async () => {
	const year = new Date().getUTCFullYear();

	// Income and expenses per month of this year. The opening balance is neither.
	const rows = await db
		.select({
			month: sql<number>`extract(month from ${transactions.date})::int`,
			income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0), 0)`,
			expenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} < 0), 0)`
		})
		.from(transactions)
		.where(
			and(
				gte(transactions.date, `${year}-01-01`),
				lte(transactions.date, `${year}-12-31`),
				ne(transactions.source, 'opening')
			)
		)
		.groupBy(sql`1`);

	const byMonth = new Map(rows.map((row) => [row.month, row]));

	// Always twelve entries, so the chart has its full frame even with no rows.
	// Expenses stay negative: they are drawn downward from zero.
	const months = MONTHS.map((label, index) => {
		const row = byMonth.get(index + 1);
		return {
			month: label,
			income: Number(row?.income ?? 0),
			expenses: Number(row?.expenses ?? 0)
		};
	});

	return { year, months };
};
