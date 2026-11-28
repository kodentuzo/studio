import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins/organization';

// The sign-in library's organization plugin, set up for Studio: who belongs to an organization,
// in which role, and who has been invited. It is kept apart from auth.ts so that scripts/seed.ts
// can use the very same setup; nothing here depends on Studio running.
//
// One Studio is one organization: the people who use this installation. The plugin works on
// Studio's own "organizations" table, which therefore holds a single row, and names its tables and columns the
// way Studio's are named. Two things it could do are closed, because an organization's slug is
// also the name of its folder on disk: deleting one through the plugin, and changing a slug.
// Studio's own pages do the first, and nothing does the second.
//
// One rule about roles holds for Studio's pages and for the plugin's own endpoints alike: what
// touches an owner is for owners. An admin can look after members and other admins, and nothing
// more. Only an owner can make someone an owner, change or remove an owner, invite someone as an
// owner, withdraw such an invitation, or change the organization itself. The plugin refuses the
// first three by itself; the rest is refused in the hooks below. Studio's settings page checks
// all of it once more before it asks the plugin.

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
	return null;
}

function refuse(message: string): never {
	throw new APIError('BAD_REQUEST', { message });
}

const hasOwner = (role: string | null | undefined) => (role ?? '').split(',').includes('owner');

/** The database, as far as this file needs it: Studio's pool of connections. */
type Database = {
	query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export function organizationPlugin(database: Database) {
	// Refuses unless the person is an owner of the organization.
	async function ownersOnly(userId: string, organizationId: string) {
		const found = await database.query(
			'select role from organization_members where organization_id = $1 and user_id = $2',
			[organizationId, userId]
		);
		if (!found.rows.some((row) => hasOwner(String(row.role)))) {
			refuse('Only an owner of the organization can do that.');
		}
	}

	return organization({
		// One Studio is one organization. It is made once, when Studio is set up, and after that
		// nobody can make another.
		allowUserToCreateOrganization: async () => {
			const existing = await database.query('select 1 from organizations limit 1');
			return existing.rows.length === 0;
		},
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
				if (!hasOwner(member.role)) refuse('Only an owner of the organization can do that.');
				if (organization.slug !== undefined) refuse('The slug of an organization cannot be changed.');
				if (organization.name !== undefined) {
					const problem = nameProblem(organization.name.trim());
					if (problem) refuse(problem);
				}
			},
			// What touches an owner is for owners: see the top of this file. Invitations are checked
			// here. Changing and removing members is checked by the plugin itself, whose hooks for
			// those are told who is being changed and not who is doing it.
			beforeCreateInvitation: async ({ invitation, inviter, organization }) => {
				if (hasOwner(invitation.role)) await ownersOnly(inviter.id, organization.id);
			},
			beforeCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
				if (hasOwner(invitation.role)) await ownersOnly(cancelledBy.id, organization.id);
			}
		}
	});
}
