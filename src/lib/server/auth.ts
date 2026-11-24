import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL, POSTGRES_URL } from '$app/env/private';
import pg from 'pg';

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	database: new pg.Pool({ connectionString: POSTGRES_URL }),
	emailAndPassword: {
		enabled: true
	},
	// Must stay last: it sets cookies for calls made on the server.
	plugins: [sveltekitCookies(getRequestEvent)]
});
