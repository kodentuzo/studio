import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Tables the sign-in library makes and looks after, described here only so that Studio can read
// them in its own queries. They are deliberately not in schema.ts: that file is what migration
// files are written from, and these tables are not Studio's to create or change. Their names
// and columns are set in ../organization-plugin.ts.

/** Who belongs to which organization, and in which role: 'owner', 'admin' or 'member'. */
export const organizationMembers = pgTable('organization_members', {
	id: uuid('id').primaryKey(),
	organizationId: uuid('organization_id').notNull(),
	userId: uuid('user_id').notNull(),
	role: text('role').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

/** Who is in which team. A person is in a team or not: what they may do comes from their role. */
export const teamMembers = pgTable('team_members', {
	id: uuid('id').primaryKey(),
	teamId: uuid('team_id').notNull(),
	userId: uuid('user_id').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true })
});

/** The accounts people sign in with. Only what Studio shows of one is described. */
export const users = pgTable('user', {
	id: uuid('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull()
});
