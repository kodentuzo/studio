// The named links a project can have. They are stored together in the project's `urls`, and
// each is read only if it is there. To add a kind of link, add a line here: no migration.
export const PROJECT_LINKS = [
	{
		key: 'app',
		label: 'App',
		hint: 'Where the app itself is.',
		placeholder: 'https://sokoban.example'
	},
	{
		key: 'privacy',
		label: 'Privacy policy',
		hint: 'What the app does with personal data.',
		placeholder: 'https://sokoban.example/privacy'
	},
	{
		key: 'terms',
		label: 'Terms',
		hint: 'The terms of using the app.',
		placeholder: 'https://sokoban.example/terms'
	}
] as const;

export type ProjectLinkKey = (typeof PROJECT_LINKS)[number]['key'];

/** The links every project should have before it goes in front of people. */
export const REQUIRED_PROJECT_LINKS: ProjectLinkKey[] = ['privacy', 'terms'];

export function isProjectLinkKey(key: string): key is ProjectLinkKey {
	return PROJECT_LINKS.some((link) => link.key === key);
}

/** True for a full https:// address, at most 500 characters. */
export function isHttpsUrl(value: string) {
	if (value.length > 500) return false;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.hostname.includes('.');
	} catch {
		return false;
	}
}
