import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { and, eq } from 'drizzle-orm';
import { auth } from '#lib/server/auth.js';
import { organizationMembers } from '#lib/server/db/auth-tables.js';
import { db } from '#lib/server/db/index.js';
import { organizations } from '#lib/server/db/schema.js';
import { nameProblem } from '#lib/server/organization-plugin.js';
import {
	isOwner,
	managesMembers,
	requireOrganization,
	requireOwnedOrganization
} from '#lib/server/organizations.js';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['owner', 'admin', 'member'];

export const load: PageServerLoad = async ({ request, locals }) => {
	const organization = await requireOrganization();
	const { name, createdAt } = organization;

	// Asked of the sign-in library, which keeps the list. Oldest first, so the list stays put.
	const listed = await auth.api.listMembers({
		query: { organizationId: organization.id, sortBy: 'createdAt', sortDirection: 'asc' },
		headers: request.headers
	});

	// Invitations still waiting for an answer. Only those who can invite get to see them.
	const invited = managesMembers(organization)
		? await auth.api.listInvitations({
				query: { organizationId: organization.id },
				headers: request.headers
			})
		: [];
	const now = new Date();

	return {
		invitations: invited
			.filter((invitation) => invitation.status === 'pending' && invitation.expiresAt > now)
			.map((invitation) => ({
				// Also the last part of the link the invited person opens: /invitations/<id>.
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				expires: invitation.expiresAt
			})),
		settings: { name, createdAt },
		// Every member can read the settings. Only an owner can change them.
		canManage: isOwner(organization),
		// Owners and admins look after who belongs.
		canManageMembers: managesMembers(organization),
		members: listed.members.map((member) => ({
			id: member.id,
			name: member.user.name,
			email: member.user.email,
			role: member.role,
			joined: member.createdAt,
			isYou: member.userId === locals.user?.id
		}))
	};
};

const OWNERS_ONLY = 'Only an owner of the organization can do that.';

/** True if the member row belongs to an owner of the organization. */
async function memberIsOwner(organizationId: string, memberId: string) {
	// An id that is not a uuid names nobody.
	if (!/^[0-9a-f-]{36}$/i.test(memberId)) return false;
	const [member] = await db
		.select({ role: organizationMembers.role })
		.from(organizationMembers)
		.where(
			eq(organizationMembers.id, memberId)
		);
	return member ? isOwner(member) : false;
}

/** The sign-in library's refusal as a sentence for the page. Anything else is a real failure. */
function refusal(thrown: unknown, action: string) {
	if (!(thrown instanceof APIError)) throw thrown;
	const error = thrown.body?.message ?? 'That could not be done.';
	return fail(thrown.statusCode === 403 ? 403 : 400, { action, error });
}

export const actions: Actions = {
	// Saves the General section, for an owner.
	general: async ({ request }) => {
		const organization = await requireOwnedOrganization();
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		const problem = nameProblem(name);
		if (problem) return fail(400, { action: 'general', error: problem });

		await db.update(organizations).set({ name }).where(eq(organizations.id, organization.id));

		return { action: 'general', saved: true };
	},

	// Changes what a member may do. The sign-in library decides who may change whom: an admin
	// cannot touch an owner, and an organization always keeps at least one owner.
	memberRole: async ({ request }) => {
		const organization = await requireOrganization();
		const form = await request.formData();
		const memberId = String(form.get('memberId') ?? '');
		const role = String(form.get('role') ?? '');
		if (!ROLES.includes(role)) return fail(400, { action: 'members', error: 'Unknown role.' });
		// What touches an owner is for owners: making one, or changing one.
		if (
			!isOwner(organization) &&
			(role === 'owner' || (await memberIsOwner(organization.id, memberId)))
		) {
			return fail(403, { action: 'members', error: OWNERS_ONLY });
		}

		try {
			await auth.api.updateMemberRole({
				body: { memberId, role, organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			return refusal(thrown, 'members');
		}
		return { action: 'members', saved: true };
	},

	// Takes a member out of the organization. Their account stays, and so does what they made.
	removeMember: async ({ request }) => {
		const organization = await requireOrganization();
		const form = await request.formData();
		const memberId = String(form.get('memberId') ?? '');
		if (!isOwner(organization) && (await memberIsOwner(organization.id, memberId))) {
			return fail(403, { action: 'members', error: OWNERS_ONLY });
		}

		try {
			await auth.api.removeMember({
				body: { memberIdOrEmail: memberId, organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			return refusal(thrown, 'members');
		}
		return { action: 'members', saved: true };
	},

	// Invites someone by email. Nothing is sent: the page shows a link to pass on, and only the
	// account with that email can use it.
	invite: async ({ request }) => {
		const organization = await requireOrganization();
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const role = String(form.get('role') ?? '');
		const refuse = (status: number, error: string) =>
			fail(status, { action: 'invite', email, role, error });

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refuse(400, 'Enter an email address.');
		if (!ROLES.includes(role)) return refuse(400, 'Unknown role.');
		if (role === 'owner' && !isOwner(organization)) return refuse(403, OWNERS_ONLY);

		try {
			await auth.api.createInvitation({
				body: { email, role: role as 'owner' | 'admin' | 'member', organizationId: organization.id },
				headers: request.headers
			});
		} catch (thrown) {
			if (!(thrown instanceof APIError)) throw thrown;
			return refuse(
				thrown.statusCode === 403 ? 403 : 400,
				thrown.body?.message ?? 'The invitation could not be made.'
			);
		}
		return { action: 'invite', invited: email };
	},

	// Withdraws an invitation, so its link stops working.
	cancelInvitation: async ({ request }) => {
		await requireOrganization();
		const form = await request.formData();
		const invitationId = String(form.get('invitationId') ?? '');

		try {
			await auth.api.cancelInvitation({ body: { invitationId }, headers: request.headers });
		} catch (thrown) {
			return refusal(thrown, 'members');
		}
		return { action: 'members', saved: true };
	}
};
