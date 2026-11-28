// Fills a development database with something to look at: `pnpm db:seed`.
//
// It adds an account to sign in with, and the organization Acme, which that account owns, with
// one project and a few transactions. What is already there is left alone, so running it again
// changes nothing.
// Never run it against a real installation: the account's password is written right here.
//
// It runs outside Studio, so it reads the database address from the environment itself and
// brings the tables up to date first, the way Studio does when it starts.

import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { organizations, projects, transactions } from '../src/lib/server/db/schema.ts';
import { organizationPlugin } from '../src/lib/server/organization-plugin.ts';

const url = process.env.POSTGRES_URL;
if (!url) {
	console.error('POSTGRES_URL is not set. Copy .env.example to .env first.');
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: 'drizzle' });

// The account to sign in with. It is made through the sign-in library itself, set up as in
// src/lib/server/auth.ts, so the password is stored the way Studio expects.
const ACCOUNT = { name: 'Admin', email: 'admin@example.com', password: '1234567890' };

const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	database: pool,
	emailAndPassword: { enabled: true },
	advanced: { database: { generateId: 'uuid' } },
	plugins: [organizationPlugin(pool)]
});
const { runMigrations } = await getMigrations(auth.options);
await runMigrations();

const known = await pool.query('select 1 from "user" where email = $1', [ACCOUNT.email]);
if (known.rowCount === 0) {
	await auth.api.signUpEmail({ body: ACCOUNT });
}

const account = await pool.query('select id from "user" where email = $1', [ACCOUNT.email]);

// The organization is made through the sign-in library too, which makes the account its owner.
const [seeded] = await db.select().from(organizations).limit(1);
if (!seeded) {
	await auth.api.createOrganization({
		body: { name: 'Acme', slug: 'acme', userId: account.rows[0].id }
	});
}

await db
	.insert(projects)
	.values({
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
console.log(`Seeded the organization Acme and the account ${ACCOUNT.email}.`);
