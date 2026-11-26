/** A slug to suggest for a name: "My Blog!" becomes "my-blog". At most 40 characters. */
export function suggestSlug(name: string) {
	return (
		name
			.toLowerCase()
			.normalize('NFKD')
			// Drop accents, so "crêpe" becomes "crepe" and not "cre-pe".
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.replace(/-+$/, '')
	);
}
