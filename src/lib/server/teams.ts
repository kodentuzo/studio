import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { teams } from './db/schema.js';
import { fileInfo, openFile, readFileBytes, removeFile, saveUpload } from './media.js';

export type Team = typeof teams.$inferSelect;

/** Every team, oldest first. The first one is where "/" leads. */
export async function listTeams(): Promise<Team[]> {
	return db.select().from(teams).orderBy(asc(teams.createdAt), asc(teams.slug));
}

/**
 * The team an address names: the "acme" in /teams/acme/projects. Answers "not found" if there
 * is no such team. Every page and action under a team starts here, and uses the team's id in
 * each query it makes.
 */
export async function requireTeam(slug: string): Promise<Team> {
	const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
	if (!team) error(404, 'That team does not exist.');
	return team;
}

/**
 * A team's own part of the media folder: teams/<slug>. Paths go in and come out without that
 * part, such as "projects/blog/icon.png", and that is also how they are stored in the database.
 */
export function teamMedia(team: { slug: string }) {
	const root = `teams/${team.slug}`;
	const inside = (path: string) => `${root}/${path}`;

	return {
		/** The path from the top of the media folder, for code that takes one. */
		path: inside,
		info: (path: string) => fileInfo(inside(path)),
		open: (path: string) => openFile(inside(path)),
		read: (path: string) => readFileBytes(inside(path)),
		remove: (path: string) => removeFile(inside(path)),
		async save(file: File, dir: string) {
			const stored = await saveUpload(file, inside(dir));
			return 'error' in stored ? stored : { ...stored, path: stored.path.slice(root.length + 1) };
		}
	};
}
