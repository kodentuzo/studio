type Address = { searchParams: { get(name: string): string | null } };

/**
 * Where to go after signing in: the "next" in /auth/sign-in?next=/invitations/abc, or "/".
 * Only a path inside Studio is accepted, so a link cannot send someone to another site.
 */
export function nextPath(url: Address): string {
	const next = url.searchParams.get('next') ?? '';
	return /^\/(?![/\\])/.test(next) ? next : '/';
}

/** A sign-in or sign-up address that carries the same "next" along. */
export function withNext(path: string, url: Address): string {
	const next = nextPath(url);
	return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}
