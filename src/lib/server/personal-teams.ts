import { and, isNotNull, notExists, eq } from 'drizzle-orm';
import { organizationMembers } from './db/auth-tables.js';
import { db } from './db/index.js';
import { teams } from './db/schema.js';
import { removeFolder } from './media.js';

// A personal team lasts exactly as long as its person is in the organization. When they are
// removed, or leave, it goes with them: the team, its projects and its files.

/**
 * Deletes every personal team whose person is no longer in the organization, and answers their
 * slugs. Run right after someone is removed or leaves, and once when Studio starts, in case
 * that was ever missed.
 *
 * The rows first: deleting a team deletes its projects and its list of members with it. Then
 * the files, which the database knows nothing about. In this order a failure can leave files
 * nobody points at, never rows pointing at files that are gone.
 */
export async function removeLeftPersonalTeams(): Promise<string[]> {
	const gone = await db
		.delete(teams)
		.where(
			and(
				isNotNull(teams.personalUserId),
				notExists(
					db
						.select({ id: organizationMembers.id })
						.from(organizationMembers)
						.where(eq(organizationMembers.userId, teams.personalUserId))
				)
			)
		)
		.returning({ slug: teams.slug });

	for (const team of gone) {
		await removeFolder(`teams/${team.slug}`);
	}
	return gone.map((team) => team.slug);
}
