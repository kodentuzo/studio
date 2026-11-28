import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
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

/** Every organization, oldest first. The first one is where "/" leads. */
export async function listOrganizations(): Promise<Organization[]> {
	return db
		.select()
		.from(organizations)
		.orderBy(asc(organizations.createdAt), asc(organizations.slug));
}

/**
 * The organization an address names: the "acme" in /organizations/acme/projects. Answers "not
 * found" if there is no such organization. Every page and action under an organization starts here,
 * and uses the organization's id in each query it makes.
 */
export async function requireOrganization(slug: string): Promise<Organization> {
	const [organization] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.slug, slug));
	if (!organization) error(404, 'That organization does not exist.');
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
