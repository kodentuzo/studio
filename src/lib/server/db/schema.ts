import { sql } from 'drizzle-orm';
import {
	char,
	check,
	date,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// The organization this Studio belongs to: the people who use this installation. One Studio is
// one organization, so this table holds a single row, made when Studio is set up. Nothing else
// points at it, because everything in this database belongs to it.
//
// The sign-in library reads and writes this table too: it is the "organization" of its
// organization plugin, set up in src/lib/server/organization-plugin.ts. Who belongs to the
// organization, and who has been invited, are tables that library looks after itself.
export const organizations = pgTable(
	'organizations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// A short name the sign-in library asks for, worked out from the name. Studio shows it
		// nowhere.
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		// Two columns the sign-in library expects. Studio does not use them yet.
		logo: text('logo'),
		metadata: text('metadata')
	},
	(table) => [
		check(
			'organizations_slug_shape',
			sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(${table.slug}) <= 40`
		),
		check('organizations_name_length', sql`char_length(${table.name}) between 1 and 45`),
		// At most one row: every row has the same value here, and no two rows may share it. Two
		// people setting Studio up at the same instant cannot both succeed.
		uniqueIndex('organizations_only_one').on(sql`(true)`)
	]
);

// A group of people in the organization, and the workspace they share. Each team has its own
// address, /teams/<slug>, and its own folder in the media folder, teams/<slug>.
//
// The sign-in library reads and writes this table too: it is the "team" of its organization
// plugin. Who is in a team is a table that library looks after itself.
export const teams = pgTable(
	'teams',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		// The short name in the team's address and the name of its folder. It never changes.
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		// Two columns the sign-in library keeps: when the team last changed, and how many people
		// are in it.
		updatedAt: timestamp('updated_at', { withTimezone: true }),
		memberCount: integer('member_count').notNull().default(0)
	},
	(table) => [
		check(
			'teams_slug_shape',
			sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(${table.slug}) <= 40`
		),
		check('teams_name_length', sql`char_length(${table.name}) between 1 and 45`)
	]
);

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

// The invoices, receipts and other papers that belong to a transaction. Each one is a file in
// the "finances" folder of the media folder, named after its id. Nobody
// browses that folder, so the name the file was uploaded under is kept here.
export const transactionDocuments = pgTable(
	'transaction_documents',
	{
		// Also the file's name on disk, with an ending for its type: <id>.pdf.
		id: uuid('id').primaryKey().defaultRandom(),
		// Empty between the upload and the save of the transaction it was uploaded for. One left
		// that way was never saved, and is cleared out after a day.
		transactionId: uuid('transaction_id').references(() => transactions.id, {
			onDelete: 'cascade'
		}),
		name: text('name').notNull(),
		contentType: text('content_type').notNull(),
		// In bytes.
		size: integer('size').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('transaction_documents_transaction').on(table.transactionId)]
);

// An app Studio looks after. For now a project is its branding, shaped like a simple web
// manifest, plus a few named links. Only the slug and the name are required.
export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// The short name in the project's address. No two projects share it.
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		// The label under the home-screen icon. When empty, the name is used.
		shortName: text('short_name'),
		description: text('description'),
		themeColor: text('theme_color'),
		backgroundColor: text('background_color'),
		// The icon's path inside the media folder.
		iconPath: text('icon_path'),
		// Named links, read if present: app, privacy, terms. The allowed names and the shape of
		// each link are checked in code; here only that it is an object.
		urls: jsonb('urls').$type<Record<string, string>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		check(
			'projects_slug_shape',
			sql`${table.slug} ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(${table.slug}) <= 40`
		),
		check('projects_name_length', sql`char_length(${table.name}) between 1 and 45`),
		check('projects_short_name_length', sql`char_length(${table.shortName}) <= 12`),
		check('projects_description_length', sql`char_length(${table.description}) <= 300`),
		check('projects_theme_color_shape', sql`${table.themeColor} ~ '^#[0-9a-fA-F]{6}$'`),
		check(
			'projects_background_color_shape',
			sql`${table.backgroundColor} ~ '^#[0-9a-fA-F]{6}$'`
		),
		check('projects_urls_is_object', sql`jsonb_typeof(${table.urls}) = 'object'`)
	]
);
