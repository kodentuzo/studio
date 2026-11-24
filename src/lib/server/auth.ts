import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { pool } from './db/index.js';

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	database: pool,
	emailAndPassword: {
		enabled: true
	},
	// Must stay last: it sets cookies for calls made on the server.
	plugins: [sveltekitCookies(getRequestEvent)]
});
