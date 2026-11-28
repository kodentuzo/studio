import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { organizations } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

// Addresses under /organizations that are pages of their own, so no organization can have them as
// its slug.
const RESERVED = ['new'];

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/sign-in');
	return {};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const slug = String(form.get('slug') ?? '').trim();
		const refuse = (status: number, error: string) => fail(status, { name, slug, error });

		if (!name) return refuse(400, 'Give the organization a name.');
		if (name.length > 45) return refuse(400, 'The name can be at most 45 characters.');
		if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 40) {
			return refuse(
				400,
				'The slug can have lowercase letters, digits and hyphens, up to 40 characters, and cannot start or end with a hyphen.'
			);
		}
		if (RESERVED.includes(slug)) {
			return refuse(400, `The slug "${slug}" is used by Studio itself. Choose another.`);
		}

		// A slug already taken makes the insert do nothing and return nothing: the rule that slugs
		// are unique decides, even when two people create the same one at the same instant.
		const [created] = await db
			.insert(organizations)
			.values({ name, slug })
			.onConflictDoNothing({ target: organizations.slug })
			.returning({ slug: organizations.slug });
		if (!created) return refuse(409, `The slug "${slug}" is already used.`);

		redirect(303, `/organizations/${created.slug}`);
	}
};
