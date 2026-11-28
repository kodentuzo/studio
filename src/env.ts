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
	AUTH_URL: {
		description:
			'The address of the account service, where people sign in and keep their account, such as http://localhost:5174.',
		schema: (value) => {
			if (!value) throw new Error('AUTH_URL is not set');
			return new URL(value).origin;
		}
	},
	AUTH_CLIENT_ID: {
		description:
			'The name Studio gives when it asks the account service to sign someone in. The same in both.'
	},
	AUTH_CLIENT_SECRET: {
		description:
			'The secret Studio proves itself to the account service with. The same in both. At least 32 characters.',
		schema: (value) => {
			if (!value || value.length < 32) {
				throw new Error('AUTH_CLIENT_SECRET must be at least 32 characters');
			}
			return value;
		}
	},
	MEDIA_DIR: {
		description:
			'The folder media files are kept in. It must survive restarts, so in a container it has to be a volume.',
		schema: (value) => value || 'data/media'
	},
	VAULT_S3_ENDPOINT: {
		description:
			'The S3-style storage server the vault is kept on, such as https://fsn1.your-objectstorage.com.'
	},
	VAULT_S3_BUCKET: {
		description: 'The bucket for the vault. It has to exist already.'
	},
	VAULT_S3_ACCESS_KEY_ID: {
		description: 'The access key for the vault bucket.'
	},
	VAULT_S3_SECRET_ACCESS_KEY: {
		description: 'The secret key for the vault bucket.'
	},
	VAULT_S3_REGION: {
		description: 'The region the storage server expects in signatures, such as fsn1.',
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
