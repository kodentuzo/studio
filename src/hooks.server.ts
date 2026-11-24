import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getMigrations } from 'better-auth/db/migration';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { auth } from '#lib/server/auth.js';
import { db } from '#lib/server/db/index.js';
import { ensureBucket } from '#lib/server/storage.js';

// Runs once when the server starts: creates or updates the tables.
export const init: ServerInit = async () => {
	// Studio's own tables, from the migration files in ./drizzle.
	await migrate(db, { migrationsFolder: 'drizzle' });

	// The bucket files are kept in.
	await ensureBucket();

	// The sign-in tables, which Better Auth looks after itself.
	const { runMigrations } = await getMigrations(auth.options);
	await runMigrations();
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

	// Everything needs a signed-in user, except signing in itself.
	if (!event.locals.user && !isAuthPage && !isAuthApi) {
		redirect(303, '/auth/sign-in');
	}

	// A signed-in user has no use for the sign-in and sign-up pages.
	if (event.locals.user && isAuthPage) {
		redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
