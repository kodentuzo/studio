import { defineEnvVars } from '@sveltejs/kit/env';

// The settings Studio is started with. Each one is read when the app starts and never sent to
// the browser. See .env.example for development values.
export const variables = defineEnvVars({
	POSTGRES_URL: {
		description: 'The Postgres server Studio keeps its own data on.'
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs sessions. At least 32 characters.',
		schema: (value) => {
			if (!value || value.length < 32) {
				throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
			}
			return value;
		}
	},
	BETTER_AUTH_URL: {
		description: 'The address Studio is reached at, such as http://localhost:5173.'
	}
});
