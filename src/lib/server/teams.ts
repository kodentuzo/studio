import { error } from '@sveltejs/kit';
import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { teamMembers } from './db/auth-tables.js';
import { db } from './db/index.js';
import { teams } from './db/schema.js';
import { managesMembers, requireOrganization } from './organizations.js';

export type Team = typeof teams.$inferSelect;

// Who sees which team: the owners and admins of the organization see every team, and everyone
// else sees the teams they are in. A team someone may not see is answered exactly like one that
// does not exist.

/** The teams a person sees, oldest first. `seesAll` is true for an owner or an admin. */
export async function listTeamsOf(userId: string, seesAll: boolean): Promise<Team[]> {
	if (seesAll) return db.select().from(teams).orderBy(asc(teams.createdAt), asc(teams.slug));
	return db
		.select(getTableColumns(teams))
		.from(teams)
		.innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
		.where(eq(teamMembers.userId, userId))
		.orderBy(asc(teams.createdAt), asc(teams.slug));
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
