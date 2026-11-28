import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.js';
import type { Actions, PageServerLoad } from './$types';

// The page an invitation link leads to: /invitations/<id>. Someone who is not signed in is sent
// to sign in first and comes back here (see hooks.server.ts).
//
// The sign-in library only shows an invitation to the account whose email it was made for, and
// only while it is pending and not expired. Every other case is answered the same way here, so
// the link tells a stranger nothing.

export const load: PageServerLoad = async ({ params, request, locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');

	try {
		const invitation = await auth.api.getInvitation({
			query: { id: params.id },
			headers: request.headers
		});
		return {
			email: locals.user.email,
			invitation: {
				organization: invitation.organizationName,
				inviter: invitation.inviterEmail,
				role: invitation.role
			}
		};
	} catch (thrown) {
		if (!(thrown instanceof APIError)) throw thrown;
		return { email: locals.user.email, invitation: null };
	}
};

export const actions: Actions = {
	accept: async ({ params, request }) => {
		try {
			await auth.api.acceptInvitation({
				body: { invitationId: params.id },
				headers: request.headers
			});
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			return fail(400, { error: thrown.body?.message ?? 'The invitation could not be accepted.' });
		}
		redirect(303, '/');
	},

	decline: async ({ params, request }) => {
		try {
			await auth.api.rejectInvitation({
				body: { invitationId: params.id },
				headers: request.headers
			});
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			return fail(400, { error: thrown.body?.message ?? 'The invitation could not be declined.' });
		}
		redirect(303, '/');
	}
};
