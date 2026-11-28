import { redirect } from '@sveltejs/kit';
import { AUTH_URL, BETTER_AUTH_URL } from '$app/env/private';
import { auth } from '#lib/server/auth.js';
import { pool } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

// Signing out ends two sessions: Studio's own, and the one on the account service. Without the
// second, the next visit would walk straight back in.
export const POST: RequestHandler = async ({ locals, request }) => {
	const address = new URL('/api/auth/oauth2/end-session', AUTH_URL);
	// Where the account service sends the browser afterwards: back to Studio.
	address.searchParams.set('post_logout_redirect_uri', `${new URL(BETTER_AUTH_URL).origin}/`);

	if (locals.user) {
		// The proof of sign-in the account service gave. Showing it again is how it knows which
		// session to end, without asking the person to confirm.
		const kept = await pool.query(
			`select "idToken" from account where "userId" = $1 and "providerId" = 'auth'`,
			[locals.user.id]
		);
		const proof = kept.rows[0]?.idToken;
		if (proof) address.searchParams.set('id_token_hint', proof);

		await auth.api.signOut({ headers: request.headers });
	}

	redirect(303, address.href, { external: [AUTH_URL] });
};
