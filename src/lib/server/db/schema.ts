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

// A group of people and everything they keep in Studio. Each organization has its own address,
// /organizations/<slug>, and what belongs to an organization points at its id.
//
// The sign-in library reads and writes this table too: it is the "organization" of its
// organization plugin, set up in src/lib/server/organization-plugin.ts. Who belongs to an
// organization, and who has been invited, are tables that library looks after itself.
export const organizations = pgTable(
	'organizations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// The short name in the organization's address. Other tables point at the id, never at
		// this.
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
		check('organizations_name_length', sql`char_length(${table.name}) between 1 and 45`)
	]
);

// Money in and money out, one row each. A negative amount is money out, a positive one money in.
export const transactions = pgTable(
	'transactions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// The organization whose money it is. Deleting an organization deletes its transactions.
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
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
		// Each organization has at most one opening balance.
		uniqueIndex('transactions_one_opening')
			.on(table.organizationId, table.source)
			.where(sql`${table.source} = 'opening'`)
	]
);

// The invoices, receipts and other papers that belong to a transaction. Each one is a file in
// the "finances" folder of its organization's part of the media folder, named after its id. Nobody
// browses that folder, so the name the file was uploaded under is kept here.
export const transactionDocuments = pgTable(
	'transaction_documents',
	{
		// Also the file's name on disk, with an ending for its type: <id>.pdf.
		id: uuid('id').primaryKey().defaultRandom(),
		// The organization it belongs to, known from the moment it is uploaded.
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
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
		// The organization it belongs to. Deleting an organization deletes its projects.
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		// The short name in the project's address, after its organization's. No two projects of one
		// organization share it.
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		// The label under the home-screen icon. When empty, the name is used.
		shortName: text('short_name'),
		description: text('description'),
		themeColor: text('theme_color'),
		backgroundColor: text('background_color'),
		// The icon's path inside the organization's part of the media folder.
		iconPath: text('icon_path'),
		// Named links, read if present: app, privacy, terms. The allowed names and the shape of
		// each link are checked in code; here only that it is an object.
		urls: jsonb('urls').$type<Record<string, string>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		unique('projects_organization_slug_unique').on(table.organizationId, table.slug),
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
