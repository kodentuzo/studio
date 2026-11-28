import { error, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { auth } from '#lib/server/auth.js';
import { organizationMembers, teamMembers, users } from '#lib/server/db/auth-tables.js';
import { db } from '#lib/server/db/index.js';
import { teams } from '#lib/server/db/schema.js';
import { teamNameProblem } from '#lib/server/organization-plugin.js';
import { managesMembers, requireOrganization } from '#lib/server/organizations.js';
import { requireTeam, teamMedia } from '#lib/server/teams.js';
import type { Actions, PageServerLoad } from './$types';

// A team's settings: its name, who is in it, and deleting it. Everyone in the team can read
// them. Changing them is for the organization's owners and admins: a team has no roles of its
// own.
//
// A personal team has no settings. Its name, its one member and its end all follow its person,
// so for one this page is "not found".

export const load: PageServerLoad = async ({ params, locals }) => {
	const organization = await requireOrganization();
	const team = await requireTeamWithSettings(params.team);
	const canManage = managesMembers(organization);

	const members = await db
		.select({ id: users.id, name: users.name, email: users.email, joined: teamMembers.createdAt })
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, team.id))
		.orderBy(asc(teamMembers.createdAt), asc(users.name));

	// The people of the organization who are not in the team yet, for those who can add them.
	const inTeam = members.map((member) => member.id);
	const addable = canManage
		? await db
				.select({ id: users.id, name: users.name, email: users.email })
				.from(organizationMembers)
				.innerJoin(users, eq(users.id, organizationMembers.userId))
				.where(
					and(
						eq(organizationMembers.organizationId, organization.id),
						inTeam.length ? notInArray(users.id, inTeam) : undefined
					)
				)
				.orderBy(asc(users.name))
		: [];

	return {
		settings: { name: team.name, slug: team.slug, createdAt: team.createdAt },
		canManage,
		members: members.map((member) => ({ ...member, isYou: member.id === locals.user?.id })),
		addable
	};
};

/** The team an address names, unless it is a personal team: those have no settings. */
async function requireTeamWithSettings(slug: string) {
	const team = await requireTeam(slug);
	if (team.personalUserId) error(404, 'That team does not exist.');
	return team;
}

/** The team, for what only an owner or an admin of the organization may do with it. */
async function requireManagedTeam(slug: string) {
	const organization = await requireOrganization();
	if (!managesMembers(organization)) {
		error(403, 'Only an owner or an admin of the organization can do that.');
	}
	return { organization, team: await requireTeamWithSettings(slug) };
}

/** The sign-in library's refusal as a sentence for the page. Anything else is a real failure. */
function refusal(thrown: unknown, action: string) {
	if (!(thrown instanceof APIError)) throw thrown;
	const message = thrown.body?.message ?? 'That could not be done.';
	return fail(thrown.statusCode === 403 ? 403 : 400, { action, error: message });
}

export const actions: Actions = {
	// Saves the General section. Only the name can change: the slug is part of every address
	// under the team and the name of its folder on disk.
	general: async ({ request, params }) => {
		const { organization, team } = await requireManagedTeam(params.team);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		const problem = teamNameProblem(name);
		if (problem) return fail(400, { action: 'general', error: problem });

		try {
			await auth.api.updateTeam({
				body: { teamId: team.id, data: { name, organizationId: organization.id } },
				headers: request.headers
			});
		} catch (thrown) {
			return refusal(thrown, 'general');
		}
		return { action: 'general', saved: true };
	},

	// Puts a person of the organization in the team.
	addMember: async ({ request, params }) => {
		const { organization, team } = await requireManagedTeam(params.team);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (!userId) return fail(400, { action: 'members', error: 'Choose a person.' });

		try {
			await auth.api.addTeamMember({
				body: { teamId: team.id, userId, organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			return refusal(thrown, 'members');
		}
		return { action: 'members', saved: true };
	},

	// Takes a person out of the team. They stay in the organization.
	removeMember: async ({ request, params }) => {
		const { organization, team } = await requireManagedTeam(params.team);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');

		try {
			await auth.api.removeTeamMember({
				body: { teamId: team.id, userId, organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			return refusal(thrown, 'members');
		}
		return { action: 'members', saved: true };
	},

	// Deletes the team and everything it has. The slug has to be typed, so this cannot happen by
	// a slip of the hand.
	delete: async ({ request, params }) => {
		const { team } = await requireManagedTeam(params.team);
		const form = await request.formData();
		const typed = String(form.get('slug') ?? '').trim();

		if (typed !== team.slug) {
			return fail(400, {
				action: 'delete',
				error: 'That is not the slug of this team. Nothing was deleted.'
			});
		}

		// The rows first: deleting the team deletes its projects and its list of members with it.
		// Then the files, which the database knows nothing about. In this order a failure can
		// leave files nobody points at, never rows pointing at files that are gone.
		await db.delete(teams).where(eq(teams.id, team.id));
		await teamMedia(team).removeAll();

		redirect(303, '/teams');
	}
};
