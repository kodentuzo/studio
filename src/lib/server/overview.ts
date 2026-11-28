import { and, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { projects, teams, transactions } from './db/schema.js';
import { transactionsOf, type FinanceOwner } from './finance-owner.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How many projects the overview lists. */
const RECENT = 5;

/**
 * What an Overview page shows, for the organization or for one person: this year's money month
 * by month, and the projects changed most recently. `owner` says whose money, and `teamIds`
 * which teams' projects: the ones the person sees, or just their personal team.
 */
export async function loadOverview(owner: FinanceOwner, teamIds: string[]) {
	const year = new Date().getUTCFullYear();

	// Income and expenses per month of this year, paid rows only. The opening balance is neither.
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
				ne(transactions.source, 'opening'),
				eq(transactions.status, 'paid'),
				transactionsOf(owner)
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

	const recent = teamIds.length
		? await db
				.select({
					id: projects.id,
					slug: projects.slug,
					name: projects.name,
					description: projects.description,
					iconPath: projects.iconPath,
					updatedAt: projects.updatedAt,
					team: teams.slug,
					teamName: teams.name
				})
				.from(projects)
				.innerJoin(teams, eq(teams.id, projects.teamId))
				.where(inArray(projects.teamId, teamIds))
				.orderBy(desc(projects.updatedAt), desc(projects.createdAt))
				.limit(RECENT)
		: [];

	return { year, months, recent };
}
