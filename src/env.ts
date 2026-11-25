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
	},
	MEDIA_DIR: {
		description:
			'The folder media files are kept in. It must survive restarts, so in a container it has to be a volume.',
		schema: (value) => value || 'data/media'
	},
	AI_URL: {
		description:
			'Optional. An OpenAI-compatible model server, such as Ollama at http://localhost:11434. When unset, Studio has no AI features.',
		schema: (value) => value || undefined
	},
	AI_MODEL: {
		description: 'The model to ask at AI_URL.',
		schema: (value) => value || 'granite3.3:2b'
	}
});
