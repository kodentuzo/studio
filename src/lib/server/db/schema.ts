import { sql } from 'drizzle-orm';
import {
	char,
	check,
	date,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// One row per stored file. The bytes are on disk, at `key` inside the files folder.
export const files = pgTable('files', {
	id: uuid('id').primaryKey().defaultRandom(),
	key: text('key').notNull().unique(),
	name: text('name').notNull(),
	contentType: text('content_type').notNull(),
	size: integer('size').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

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
		// Where the row came from: 'manual', or 'opening' for the one opening balance row.
		source: text('source').notNull().default('manual'),
		// 'paid' means the money has moved. 'planned' is expected and not counted yet.
		status: text('status').notNull().default('paid'),
		// The attached invoice or receipt, if any. A file in use cannot be deleted.
		fileId: uuid('file_id').references(() => files.id),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		check('transactions_amount_not_zero', sql`${table.amount} <> 0`),
		check('transactions_status_known', sql`${table.status} in ('planned', 'paid')`),
		// There is at most one opening balance.
		uniqueIndex('transactions_one_opening')
			.on(table.source)
			.where(sql`${table.source} = 'opening'`)
	]
);
