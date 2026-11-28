import { redirect } from '@sveltejs/kit';
import { AUTH_URL } from '$app/env/private';
import { auth } from '#lib/server/auth.js';
import { nextPath } from '#lib/next.js';
import type { RequestHandler } from './$types';

// Studio has no sign-in page of its own. Whoever needs to sign in is sent to the account
// service, signs in there, and comes back to the page they asked for.
export const GET: RequestHandler = async ({ url, request }) => {
	const started = await auth.api.signInSocial({
		body: { provider: 'auth', callbackURL: nextPath(url) },
		headers: request.headers
	});
	if (!started.url) throw new Error('Signing in could not be started.');
	// The account service is another address: only its own is let through.
	redirect(303, started.url, { external: [AUTH_URL] });
};
