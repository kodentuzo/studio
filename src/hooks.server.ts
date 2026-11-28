import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getMigrations } from 'better-auth/db/migration';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { auth } from '#lib/server/auth.js';
import { db } from '#lib/server/db/index.js';
import { ensureStorage } from '#lib/server/media.js';
import { removeLeftPersonalTeams } from '#lib/server/personal-teams.js';
import { ensureVault } from '#lib/server/vault.js';

// Runs once when the server starts: creates or updates the tables.
export const init: ServerInit = async () => {
	// Studio's own tables, from the migration files in ./drizzle.
	await migrate(db, { migrationsFolder: 'drizzle' });

	// The folder media files are kept in.
	await ensureStorage();

	// The bucket the vault is kept in.
	await ensureVault();

	// The sign-in tables, which Better Auth looks after itself.
	const { runMigrations } = await getMigrations(auth.options);
	await runMigrations();

	// Personal teams of people who are no longer in the organization, in case one was missed.
	await removeLeftPersonalTeams();
};

// Every request passes through here before any page or endpoint runs.
export const handle: Handle = async ({ event, resolve }) => {
	const session = building
		? null
		: await auth.api.getSession({ headers: event.request.headers });

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	const isAuthPage = event.route.id?.startsWith('/auth') ?? false;
	// Better Auth's own endpoints: sign in, sign up, sign out and the rest.
	const isAuthApi = event.url.pathname.startsWith('/api/auth');

	// A project's media files are public: anyone with the address can open one.
	const isProjectMedia =
		event.route.id === '/(app)/teams/[team]/media/projects/[slug]/[name]';

	// Everything else needs a signed-in user, except signing in itself.
	// A page that was asked for is remembered, so that signing in leads back to it: that is how
	// an invitation link works for someone who is not signed in yet.
	if (!event.locals.user && !isAuthPage && !isAuthApi && !isProjectMedia) {
		const asked = event.url.pathname + event.url.search;
		const remember = event.request.method === 'GET' && asked !== '/';
		redirect(303, remember ? `/auth/sign-in?next=${encodeURIComponent(asked)}` : '/auth/sign-in');
	}

	// A signed-in user has no use for the sign-in and sign-up pages.
	if (event.locals.user && isAuthPage) {
		redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
