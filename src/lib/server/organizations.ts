import { error } from '@sveltejs/kit';
import { asc, eq, getTableColumns } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { organizationMembers } from './db/auth-tables.js';
import { db } from './db/index.js';
import { organizations } from './db/schema.js';

export type Organization = typeof organizations.$inferSelect;

/** The organization this Studio belongs to, or null before Studio has been set up. */
export async function findOrganization(): Promise<Organization | null> {
	const [organization] = await db
		.select()
		.from(organizations)
		.orderBy(asc(organizations.createdAt))
		.limit(1);
	return organization ?? null;
}

/** The same, with the person's role, but only for someone who belongs to it. Null for anyone else. */
export async function findOrganizationOf(
	userId: string
): Promise<(Organization & { role: string }) | null> {
	const [organization] = await db
		.select({ ...getTableColumns(organizations), role: organizationMembers.role })
		.from(organizations)
		.innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
		.where(eq(organizationMembers.userId, userId))
		.orderBy(asc(organizations.createdAt))
		.limit(1);
	return organization ?? null;
}

/**
 * The organization, for the person whose request is being answered, with the role they hold in
 * it. Every action and endpoint that works on Studio's data starts here. Someone who does not
 * belong to the organization is refused.
 */
export async function requireOrganization(): Promise<Organization & { role: string }> {
	const { user } = getRequestEvent().locals;
	const [organization] = user
		? await db
				.select({ ...getTableColumns(organizations), role: organizationMembers.role })
				.from(organizations)
				.innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
				.where(eq(organizationMembers.userId, user.id))
				.orderBy(asc(organizations.createdAt))
				.limit(1)
		: [];
	if (!organization) error(403, 'You are not a member of this Studio.');
	return organization;
}

/**
 * True for an owner of the organization. A member can hold several roles, kept as one text with
 * commas between them.
 */
export function isOwner(organization: { role: string }): boolean {
	return organization.role.split(',').includes('owner');
}

/** True for someone who looks after who belongs to the organization: an owner or an admin. */
export function managesMembers(organization: { role: string }): boolean {
	const roles = organization.role.split(',');
	return roles.includes('owner') || roles.includes('admin');
}

/** The same lookup, for what only an owner may do. Anyone else is refused. */
export async function requireOwnedOrganization() {
	const organization = await requireOrganization();
	if (!isOwner(organization)) error(403, 'Only an owner of the organization can do that.');
	return organization;
}
