import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { genericOAuth } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import {
	AUTH_CLIENT_ID,
	AUTH_CLIENT_SECRET,
	AUTH_URL,
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL
} from '$app/env/private';
import { pool } from './db/index.js';
import { organizationPlugin } from './organization-plugin.js';
import { removeLeftPersonalTeams } from './personal-teams.js';

// The two ways someone stops being in the organization: being removed, and leaving.
const LEAVING = ['/organization/remove-member', '/organization/leave'];

export const auth = betterAuth({
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	database: pool,
	// Studio keeps no passwords. People sign in on the account service, and what Studio keeps of
	// a person is a copy: their name, email and username, brought up to date at every sign-in.
	user: {
		additionalFields: { username: { type: 'string', required: false } }
	},
	// The copy is only ever written by a sign-in. Nobody edits it here: a person changes their
	// account on the account service.
	disabledPaths: ['/update-user', '/change-email', '/delete-user'],
	// Someone Studio already knows by their email is the same person when the account service
	// vouches for that email: it is Kodentuzo's own, so it is believed.
	account: { accountLinking: { enabled: true, trustedProviders: ['auth'] } },
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
	plugins: [
		organizationPlugin(pool),
		genericOAuth({
			config: [
				{
					providerId: 'auth',
					clientId: AUTH_CLIENT_ID,
					clientSecret: AUTH_CLIENT_SECRET,
					// The addresses are spelled out, so Studio does not have to ask the account
					// service for them when it starts, and can start before it.
					authorizationUrl: `${AUTH_URL}/api/auth/oauth2/authorize`,
					tokenUrl: `${AUTH_URL}/api/auth/oauth2/token`,
					userInfoUrl: `${AUTH_URL}/api/auth/oauth2/userinfo`,
					scopes: ['openid', 'profile', 'email'],
					pkce: true,
					authentication: 'basic',
					// Which account this is on the account service: its id there, which never changes.
					accountSubject: ({ profile }) => String(profile.sub ?? ''),
					overrideUserInfo: true,
					// Someone who has not given a full name yet goes by their username.
					mapProfileToUser: (profile) => {
						const username = String(profile.preferred_username ?? '');
						return { name: profile.name || username, username };
					}
				}
			]
		}),
		sveltekitCookies(getRequestEvent)
	]
});
