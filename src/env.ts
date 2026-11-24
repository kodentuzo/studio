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
	S3_ENDPOINT: {
		description: 'The S3-style storage server files are kept on, such as http://localhost:9000.'
	},
	S3_BUCKET: {
		description: 'The bucket for this Studio. It is created at start if it does not exist.'
	},
	S3_ACCESS_KEY_ID: {
		description: 'The access key for the bucket.'
	},
	S3_SECRET_ACCESS_KEY: {
		description: 'The secret key for the bucket.'
	},
	S3_REGION: {
		description: 'The region the storage server expects in signatures.',
		schema: (value) => value || 'us-east-1'
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
