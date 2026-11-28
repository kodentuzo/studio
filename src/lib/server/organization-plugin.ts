import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins/organization';

// The sign-in library's organization plugin, set up for Studio: who belongs to an organization,
// in which role, and who has been invited. It is kept apart from auth.ts so that scripts/seed.ts
// can use the very same setup; nothing here depends on Studio running.
//
// One Studio is one organization: the people who use this installation. The plugin works on
// Studio's own "organizations" table, which therefore holds a single row, and names its tables
// and columns the way Studio's are named. Three things it could do are closed: making a second
// organization, deleting the one there is, and changing its slug. The organization is the
// installation itself, so it goes when the installation does.
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

/** Addresses under /teams that are pages of their own, so no team can have them as its slug. */
const RESERVED_TEAM_SLUGS = ['new'];

/** What is wrong with a name for a team, as a sentence, or null. */
export function teamNameProblem(name: string): string | null {
	if (!name) return 'Give the team a name.';
	if (name.length > 45) return 'The name can be at most 45 characters.';
	return null;
}

/** What is wrong with a slug for a team, as a sentence, or null. Whether it is taken is not checked. */
export function teamSlugProblem(slug: string): string | null {
	const problem = slugProblem(slug);
	if (problem) return problem;
	if (RESERVED_TEAM_SLUGS.includes(slug)) {
		return `The slug "${slug}" is used by Studio itself. Choose another.`;
	}
	return null;
}

/**
 * A slug for someone's personal team: their username, which is a slug already. Someone Studio
 * knows only by email, as the seed's account is before its first sign-in, gets it from that:
 * "ada.lovelace@example.com" gives "ada-lovelace". Whether it is free is for the caller to check.
 */
function personalSlug(person: { email: string; username?: string | null }) {
	const slug = (person.username || person.email.split('@')[0])
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 36)
		.replace(/-+$/, '');
	return slug || 'person';
}

/**
 * Gives a person their personal team, unless they have one: a team of their own, with nobody
 * else in it, for work that belongs to no team of the organization. Safe to call again and
 * again; the answer is always the one team.
 *
 * It writes to the database directly and not through the plugin, which would ask who is making
 * the team: nobody is, it comes with being in the organization.
 */
export async function ensurePersonalTeam(
	database: Database,
	organizationId: string,
	person: { id: string; name: string; email: string; username?: string | null }
): Promise<{ id: string; slug: string }> {
	const own = () =>
		database.query('select id, slug from teams where personal_user_id = $1', [person.id]);

	let found = (await own()).rows[0];

	// The slug is settled once. If it is taken, a number is added: ada, ada-2, ada-3.
	const base = personalSlug(person);
	for (let number = 1; !found; number++) {
		const slug = number === 1 ? base : `${base}-${number}`;
		if (RESERVED_TEAM_SLUGS.includes(slug)) continue;
		// Nothing is added when the slug is taken, or when a second request got here first.
		await database.query(
			`insert into teams (organization_id, slug, name, personal_user_id, member_count)
			 values ($1, $2, $3, $4, 1) on conflict do nothing`,
			[organizationId, slug, person.name.trim().slice(0, 45) || slug, person.id]
		);
		found = (await own()).rows[0];
	}

	const team = { id: String(found.id), slug: String(found.slug) };
	await database.query(
		`insert into team_members (id, team_id, user_id, created_at)
		 select gen_random_uuid(), $1, $2, now()
		 where not exists (select 1 from team_members where team_id = $1 and user_id = $2)`,
		[team.id, person.id]
	);
	return team;
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

	// True for a personal team: see ensurePersonalTeam above.
	async function isPersonal(teamId: string) {
		const found = await database.query('select personal_user_id from teams where id = $1', [
			teamId
		]);
		return found.rows[0]?.personal_user_id != null;
	}

	return organization({
		// One Studio is one organization. It is made once, when Studio is set up, and after that
		// nobody can make another.
		allowUserToCreateOrganization: async () => {
			const existing = await database.query('select 1 from organizations limit 1');
			return existing.rows.length === 0;
		},
		// The organization is the installation: it is not deleted from inside it.
		disableOrganizationDeletion: true,
		// Teams are the workspaces inside the organization. None is made by itself: the people
		// who look after the organization make them.
		teams: { enabled: true, defaultTeam: { enabled: false } },
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
					createdAt: 'created_at',
					teamId: 'team_id'
				}
			},
			// Studio's own "teams" table, which has one column more than the plugin knows: the slug.
			team: {
				modelName: 'teams',
				fields: {
					organizationId: 'organization_id',
					createdAt: 'created_at',
					updatedAt: 'updated_at',
					memberCount: 'member_count'
				},
				additionalFields: { slug: { type: 'string', required: true, unique: true } }
			},
			teamMember: {
				modelName: 'team_members',
				fields: { teamId: 'team_id', userId: 'user_id', createdAt: 'created_at' }
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
			// A team's slug is the name of its folder on disk, so the rules for one are checked before
			// it is made, it never changes afterwards, and a team is only deleted by Studio's own
			// page, which removes the folder with it.
			beforeCreateTeam: async ({ team }) => {
				const slug = String(team.slug ?? '');
				const problem = teamNameProblem((team.name ?? '').trim()) ?? teamSlugProblem(slug);
				if (problem) refuse(problem);
				const taken = await database.query('select 1 from teams where slug = $1', [slug]);
				if (taken.rows.length > 0) refuse(`The slug "${slug}" is already used.`);
			},
			//
			// A personal team is one person's own, so it stays as it was made: it is not renamed,
			// nobody joins it, and its person is not taken out of it.
			beforeUpdateTeam: async ({ team, updates }) => {
				if (await isPersonal(team.id)) refuse('A personal team cannot be changed.');
				if ('slug' in updates) refuse('The slug of a team cannot be changed.');
				if (updates.name !== undefined) {
					const problem = teamNameProblem(updates.name.trim());
					if (problem) refuse(problem);
				}
			},
			beforeDeleteTeam: async () => refuse('A team is deleted from its settings in Studio.'),
			beforeAddTeamMember: async ({ team }) => {
				if (await isPersonal(team.id)) refuse('A personal team is for one person only.');
			},
			beforeRemoveTeamMember: async ({ team }) => {
				if (await isPersonal(team.id)) {
					refuse('A personal team belongs to its person, who cannot be taken out of it.');
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
