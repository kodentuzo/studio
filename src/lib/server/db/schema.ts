import { sql } from 'drizzle-orm';
import { char, check, date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Money in and money out, one row each. A negative amount is money out, a positive one money in.
export const transactions = pgTable(
	'transactions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		date: date('date').notNull(),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		currency: char('currency', { length: 3 }).notNull().default('EUR'),
		counterparty: text('counterparty').notNull(),
		note: text('note'),
		// Where the row came from. Only 'manual' for now.
		source: text('source').notNull().default('manual'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [check('transactions_amount_not_zero', sql`${table.amount} <> 0`)]
);
