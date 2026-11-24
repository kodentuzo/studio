import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

// Every request passes through here before any page or endpoint runs.
export const handle: Handle = async ({ event, resolve }) => {
	// Nobody can sign in yet, so there is never a user. Real sign-in sets this.
	event.locals.user = null;

	// Everything needs a signed-in user, except the pages under /auth.
	const isAuthPage = event.route.id?.startsWith('/auth') ?? false;

	if (!event.locals.user && !isAuthPage) {
		redirect(303, '/auth/sign-in');
	}

	return resolve(event);
};
