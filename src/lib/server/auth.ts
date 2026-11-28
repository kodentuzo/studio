import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { pool } from './db/index.js';
import { organizationPlugin } from './organization-plugin.js';

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	database: pool,
	emailAndPassword: {
		enabled: true
	},
	// Ids are uuids, like the ids of Studio's own tables, so the two kinds can point at each other.
	advanced: { database: { generateId: 'uuid' } },
	// sveltekitCookies must stay last: it sets cookies for calls made on the server.
	plugins: [organizationPlugin(pool), sveltekitCookies(getRequestEvent)]
});
