import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { pool } from './db/index.js';
import { organizationPlugin } from './organization-plugin.js';
import { removeLeftPersonalTeams } from './personal-teams.js';

// The two ways someone stops being in the organization: being removed, and leaving.
const LEAVING = ['/organization/remove-member', '/organization/leave'];

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	database: pool,
	emailAndPassword: {
		enabled: true
	},
	// Ids are uuids, like the ids of Studio's own tables, so the two kinds can point at each other.
	advanced: { database: { generateId: 'uuid' } },
	// Someone who is no longer in the organization does not keep their personal team. The
	// plugin has no single place to hear of both ways out, so it is done here, after either.
	hooks: {
		after: createAuthMiddleware(async (context) => {
			if (LEAVING.includes(context.path)) await removeLeftPersonalTeams();
		})
	},
	// sveltekitCookies must stay last: it sets cookies for calls made on the server.
	plugins: [organizationPlugin(pool), sveltekitCookies(getRequestEvent)]
});
