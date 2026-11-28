import { error } from '@sveltejs/kit';
import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { organizationMembers } from './db/auth-tables.js';
import { db } from './db/index.js';
import { organizations } from './db/schema.js';
import {
	fileInfo,
	openFile,
	readFileBytes,
	removeFile,
	removeFolder,
	saveUpload
} from './media.js';

export type Organization = typeof organizations.$inferSelect;

/** The organizations a person belongs to, oldest first. The first one is where "/" leads. */
export async function listOrganizations(userId: string): Promise<Organization[]> {
	return db
		.select(getTableColumns(organizations))
		.from(organizations)
		.innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
		.where(eq(organizationMembers.userId, userId))
		.orderBy(asc(organizations.createdAt), asc(organizations.slug));
}

/**
 * The organization an address names: the "acme" in /organizations/acme/projects. Every page and
 * action under an organization starts here, and uses the organization's id in each query it
 * makes.
 *
 * It is only handed to someone who belongs to it. An organization the signed-in person is not a
 * member of is answered exactly like one that does not exist, so an address cannot be used to
 * find out which organizations there are. The person is read from the request being answered.
 */
export async function requireOrganization(
	slug: string
): Promise<Organization & { role: string }> {
	const { user } = getRequestEvent().locals;
	const [organization] = user
		? await db
				.select({ ...getTableColumns(organizations), role: organizationMembers.role })
				.from(organizations)
				.innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
				.where(and(eq(organizations.slug, slug), eq(organizationMembers.userId, user.id)))
		: [];
	if (!organization) error(404, 'That organization does not exist.');
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
export async function requireOwnedOrganization(slug: string) {
	const organization = await requireOrganization(slug);
	if (!isOwner(organization)) error(403, 'Only an owner of the organization can do that.');
	return organization;
}

/**
 * An organization's own part of the media folder: organizations/<slug>. Paths go in and come out
 * without that part, such as "projects/blog/icon.png", and that is also how they are stored in the
 * database.
 */
export function organizationMedia(organization: { slug: string }) {
	const root = `organizations/${organization.slug}`;
	const inside = (path: string) => `${root}/${path}`;

	return {
		/** The path from the top of the media folder, for code that takes one. */
		path: inside,
		info: (path: string) => fileInfo(inside(path)),
		open: (path: string) => openFile(inside(path)),
		read: (path: string) => readFileBytes(inside(path)),
		remove: (path: string) => removeFile(inside(path)),
		/** Deletes every file the organization has. For when the organization itself is deleted. */
		removeAll: () => removeFolder(root),
		async save(file: File, dir: string) {
			const stored = await saveUpload(file, inside(dir));
			return 'error' in stored ? stored : { ...stored, path: stored.path.slice(root.length + 1) };
		}
	};
}
