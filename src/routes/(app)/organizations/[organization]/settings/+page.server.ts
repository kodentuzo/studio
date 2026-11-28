import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { organizations } from '#lib/server/db/schema.js';
import { nameProblem } from '#lib/server/organization-plugin.js';
import { requireOrganization, organizationMedia } from '#lib/server/organizations.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const organization = await requireOrganization(params.organization);
	const { name, slug, createdAt } = organization;
	return { settings: { name, slug, createdAt } };
};

export const actions: Actions = {
	// Saves the General section. Only the name can change: the slug is part of every address and
	// of the organization's folder on disk.
	general: async ({ request, params }) => {
		const organization = await requireOrganization(params.organization);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		const problem = nameProblem(name);
		if (problem) return fail(400, { action: 'general', error: problem });

		await db.update(organizations).set({ name }).where(eq(organizations.id, organization.id));

		return { action: 'general', saved: true };
	},

	// Deletes the organization and everything it has. The slug has to be typed, so this cannot
	// happen by a slip of the hand.
	delete: async ({ request, params }) => {
		const organization = await requireOrganization(params.organization);
		const form = await request.formData();
		const typed = String(form.get('slug') ?? '').trim();

		if (typed !== organization.slug) {
			return fail(400, {
				action: 'delete',
				error: 'That is not the slug of this organization. Nothing was deleted.'
			});
		}

		// The rows first: deleting the organization deletes its projects, transactions and
		// documents with it. Then the files, which the database knows nothing about. In this order
		// a failure can leave files nobody points at, never rows pointing at files that are gone.
		await db.delete(organizations).where(eq(organizations.id, organization.id));
		await organizationMedia(organization).removeAll();

		redirect(303, '/organizations');
	}
};
