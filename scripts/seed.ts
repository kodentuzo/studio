// Fills a development database with something to look at: `pnpm db:seed`.
//
// It adds an account, the organization Acme, which that account owns, the team Games with one
// project, the account's personal team, and a few transactions. What is already there is left
// alone, so running it again changes nothing.
// To sign in as that account, run the account service's seed too: it has the password.
//
// It runs outside Studio, so it reads the database address from the environment itself and
// brings the tables up to date first, the way Studio does when it starts.

import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { organizations, projects, teams, transactions } from '../src/lib/server/db/schema.ts';
import { ensurePersonalTeam, organizationPlugin } from '../src/lib/server/organization-plugin.ts';

const url = process.env.POSTGRES_URL;
if (!url) {
	console.error('POSTGRES_URL is not set. Copy .env.example to .env first.');
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: 'drizzle' });

// The account that owns everything here. People sign in on the account service, which has the
// same account in its own seed, with the password. Studio only keeps a copy of who it is, and
// knows the two are one by the email the first time that account signs in. For that the email
// has to be marked as confirmed here: Studio only joins an account to someone it is sure of.
const ACCOUNT = { name: 'Admin', username: 'admin', email: 'admin@example.com' };

const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: pool,
	user: { additionalFields: { username: { type: 'string', required: false } } },
	advanced: { database: { generateId: 'uuid' } },
	plugins: [organizationPlugin(pool)]
});
const { runMigrations } = await getMigrations(auth.options);
await runMigrations();

await pool.query(
	`insert into "user" (id, name, username, email, "emailVerified", "createdAt", "updatedAt")
	 select gen_random_uuid(), $1, $2, $3, true, now(), now()
	 where not exists (select 1 from "user" where email = $3)`,
	[ACCOUNT.name, ACCOUNT.username, ACCOUNT.email]
);

const account = await pool.query('select id, name, username, email from "user" where email = $1', [
	ACCOUNT.email
]);

// The organization is made through the sign-in library too, which makes the account its owner.
const [seeded] = await db.select().from(organizations).limit(1);
if (!seeded) {
	await auth.api.createOrganization({
		body: { name: 'Acme', slug: 'acme', userId: account.rows[0].id }
	});
}

// A team, with the account in it.
const [madeBefore] = await db.select().from(teams).where(isNull(teams.personalUserId)).limit(1);
if (!madeBefore) {
	const [organization] = await db.select().from(organizations).limit(1);
	const [made] = await db
		.insert(teams)
		.values({ organizationId: organization.id, slug: 'games', name: 'Games', memberCount: 1 })
		.returning({ id: teams.id });
	await pool.query(
		`insert into team_members (id, team_id, user_id, created_at)
		 values (gen_random_uuid(), $1, $2, now())`,
		[made.id, account.rows[0].id]
	);
}

const [team] = await db.select().from(teams).where(isNull(teams.personalUserId)).limit(1);

// The account's personal team: its own, with nobody else in it.
const [home] = await db.select().from(organizations).limit(1);
await ensurePersonalTeam(pool, home.id, account.rows[0]);

await db
	.insert(projects)
	.values({
		teamId: team.id,
		slug: 'sokoban',
		name: 'Sokoban',
		shortName: 'Sokoban',
		description: 'Push every crate onto its mark.',
		themeColor: '#2a78d6',
		backgroundColor: '#ffffff'
	})
	.onConflictDoNothing();

// Transactions have nothing to tell two runs apart by, so they are only added when there are
// none.
const [existing] = await db.select({ id: transactions.id }).from(transactions).limit(1);

if (!existing) {
	// Dated in the current month, so the overview chart has something in it.
	const now = new Date();
	const day = (number: number) =>
		new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), number)).toISOString().slice(0, 10);

	await db.insert(transactions).values([
		{ date: day(1), amount: '500.00', counterparty: 'Opening balance', source: 'opening' },
		{ date: day(2), amount: '-7.49', counterparty: 'Hetzner', note: 'Server' },
		{ date: day(3), amount: '-12.00', counterparty: 'Namecheap', note: 'Domain renewal' },
		{ date: day(5), amount: '250.00', counterparty: 'Globex', note: 'Invoice 2026-001' },
		{ date: day(20), amount: '-20.00', counterparty: 'Anthropic', status: 'planned' }
	]);
}

await pool.end();
console.log(`Seeded the organization Acme, the team Games and the account ${ACCOUNT.email}.`);
