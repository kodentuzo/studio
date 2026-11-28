import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins/organization';

// The sign-in library's organization plugin, set up for Studio: who belongs to an organization,
// in which role, and who has been invited. It is kept apart from auth.ts so that scripts/seed.ts
// can use the very same setup; nothing here depends on Studio running.
//
// The plugin works on Studio's own "organizations" table and names its tables and columns the
// way Studio's are named. Two things it could do are closed, because an organization's slug is
// also the name of its folder on disk: deleting one through the plugin, and changing a slug.
// Studio's own pages do the first, and nothing does the second.

/** Addresses under /organizations that are pages of their own, so no organization can be one. */
const RESERVED_SLUGS = ['new'];

/** What is wrong with a name for an organization, as a sentence, or null. */
export function nameProblem(name: string): string | null {
	if (!name) return 'Give the organization a name.';
	if (name.length > 45) return 'The name can be at most 45 characters.';
	return null;
}

/** What is wrong with a slug for an organization, as a sentence, or null. */
export function slugProblem(slug: string): string | null {
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 40) {
		return 'The slug can have lowercase letters, digits and hyphens, up to 40 characters, and cannot start or end with a hyphen.';
	}
	if (RESERVED_SLUGS.includes(slug)) {
		return `The slug "${slug}" is used by Studio itself. Choose another.`;
	}
	return null;
}

function refuse(message: string): never {
	throw new APIError('BAD_REQUEST', { message });
}

export function organizationPlugin() {
	return organization({
		// Studio deletes an organization itself, so that its files go with it.
		disableOrganizationDeletion: true,
		schema: {
			organization: {
				modelName: 'organizations',
				fields: { createdAt: 'created_at' }
			},
			member: {
				modelName: 'organization_members',
				fields: { organizationId: 'organization_id', userId: 'user_id', createdAt: 'created_at' }
			},
			invitation: {
				modelName: 'organization_invitations',
				fields: {
					organizationId: 'organization_id',
					inviterId: 'inviter_id',
					expiresAt: 'expires_at',
					createdAt: 'created_at'
				}
			}
		},
		organizationHooks: {
			// The same rules the database has, checked first so that the answer is a sentence.
			beforeCreateOrganization: async ({ organization }) => {
				const problem =
					nameProblem((organization.name ?? '').trim()) ?? slugProblem(organization.slug ?? '');
				if (problem) refuse(problem);
			},
			// Changing an organization is for its owners, as on Studio's own settings page.
			beforeUpdateOrganization: async ({ organization, member }) => {
				if (!member.role.split(',').includes('owner')) {
					refuse('Only an owner of the organization can do that.');
				}
				if (organization.slug !== undefined) refuse('The slug of an organization cannot be changed.');
				if (organization.name !== undefined) {
					const problem = nameProblem(organization.name.trim());
					if (problem) refuse(problem);
				}
			}
		}
	});
}
