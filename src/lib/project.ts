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

// What a project's icon has to be. One image is the source for every icon an app needs, so it
// has to be square, large enough to scale down from, and not so large it is unsafe to open.
export const ICON_MIN_SIDE = 512;
export const ICON_MAX_SIDE = 4096;
export const ICON_RECOMMENDED_SIDE = 1024;

/**
 * Whether an image of this size can become an icon, as it is or after cropping to a square.
 * Returns what is wrong, or null. The square cut from an image is as large as its short side,
 * so that is the side that has to be big enough.
 */
export function checkIconSource(width: number, height: number): string | null {
	const is = `This image is ${width} by ${height} pixels.`;

	if (Math.max(width, height) > ICON_MAX_SIDE) {
		return `The icon can be at most ${ICON_MAX_SIDE} pixels on each side. ${is}`;
	}
	if (Math.min(width, height) < ICON_MIN_SIDE) {
		return `The icon has to be at least ${ICON_MIN_SIDE} pixels on each side. ${is}`;
	}
	return null;
}

/** What is wrong with an icon of this size, or null if it is fine as it is. */
export function checkIconSize(width: number, height: number): string | null {
	const problem = checkIconSource(width, height);
	if (problem) return problem;

	if (width !== height) {
		return `The icon has to be square. This image is ${width} by ${height} pixels.`;
	}
	return null;
}
