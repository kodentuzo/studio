import { and, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { projects } from './db/schema.js';

/**
 * True if something of the team points at this media file: for now, a project using it as its
 * icon.
 */
export async function isFileUsed(teamId: string, path: string): Promise<boolean> {
	const [icon] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(and(eq(projects.teamId, teamId), eq(projects.iconPath, path)))
		.limit(1);
	return Boolean(icon);
}
