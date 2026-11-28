import { error } from '@sveltejs/kit';
import { and, asc, eq, getTableColumns, isNull } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { teamMembers } from './db/auth-tables.js';
import { db, pool } from './db/index.js';
import { teams } from './db/schema.js';
import {
	fileInfo,
	openFile,
	readFileBytes,
	removeFile,
	removeFolder,
	saveUpload
} from './media.js';
import { ensurePersonalTeam } from './organization-plugin.js';
import { managesMembers, requireOrganization } from './organizations.js';

export type Team = typeof teams.$inferSelect;

// Who sees which team: the owners and admins of the organization see every team, and everyone
// else sees the teams they are in. A team someone may not see is answered exactly like one that
// does not exist.

/**
 * The organization's teams a person sees, oldest first. `seesAll` is true for an owner or an
 * admin. Personal teams are not among them: those are nobody's but their person's, and are
 * reached another way, through personalTeamOf.
 */
export async function listTeamsOf(userId: string, seesAll: boolean): Promise<Team[]> {
	if (seesAll) {
		return db
			.select()
			.from(teams)
			.where(isNull(teams.personalUserId))
			.orderBy(asc(teams.createdAt), asc(teams.slug));
	}
	return db
		.select(getTableColumns(teams))
		.from(teams)
		.innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
		.where(and(eq(teamMembers.userId, userId), isNull(teams.personalUserId)))
		.orderBy(asc(teams.createdAt), asc(teams.slug));
}

/**
 * A person's personal team: their own, with nobody else in it, for work that belongs to no team
 * of the organization. Everyone in the organization has one. It is made the first time it is
 * asked for, which is the person's first visit.
 */
export async function personalTeamOf(
	organization: { id: string },
	person: { id: string; name: string; email: string; username?: string | null }
): Promise<Team> {
	const own = () => db.select().from(teams).where(eq(teams.personalUserId, person.id));

	const [found] = await own();
	if (found) return found;

	await ensurePersonalTeam(pool, organization.id, person);
	const [made] = await own();
	return made;
}

/**
 * The team an address names: the "web" in /teams/web/projects, for the person whose request is
 * being answered. Every page and action under a team starts here.
 */
export async function requireTeam(slug: string): Promise<Team> {
	const organization = await requireOrganization();
	const [team] = await db.select().from(teams).where(eq(teams.slug, slug));
	if (!team) error(404, 'That team does not exist.');
	if (managesMembers(organization)) return team;

	const { user } = getRequestEvent().locals;
	const [membership] = await db
		.select({ id: teamMembers.id })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user!.id)));
	if (!membership) error(404, 'That team does not exist.');
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
		/** Deletes every file the team has. For when the team itself is deleted. */
		removeAll: () => removeFolder(root),
		async save(file: File, dir: string) {
			const stored = await saveUpload(file, inside(dir));
			return 'error' in stored ? stored : { ...stored, path: stored.path.slice(root.length + 1) };
		}
	};
}
