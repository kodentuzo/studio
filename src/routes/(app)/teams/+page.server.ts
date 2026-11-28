import { count, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { managesMembers, requireOrganization } from '#lib/server/organizations.js';
import { listTeamsOf } from '#lib/server/teams.js';
import type { PageServerLoad } from './$types';

// The organization's teams, as far as the person sees them: every team for an owner or an
// admin, and for everyone else the teams they are in. Personal teams are not among them.
export const load: PageServerLoad = async ({ locals }) => {
	const organization = await requireOrganization();
	const canManage = managesMembers(organization);
	const teams = await listTeamsOf(locals.user!.id, canManage);

	const counted = teams.length
		? await db
				.select({ teamId: projects.teamId, projects: count() })
				.from(projects)
				.where(
					inArray(
						projects.teamId,
						teams.map((team) => team.id)
					)
				)
				.groupBy(projects.teamId)
		: [];
	const projectsIn = new Map(counted.map((row) => [row.teamId, row.projects]));

	return {
		teams: teams.map((team) => ({
			slug: team.slug,
			name: team.name,
			members: team.memberCount,
			projects: projectsIn.get(team.id) ?? 0,
			createdAt: team.createdAt
		})),
		// Adding a team and changing one are for the organization's owners and admins.
		canManage
	};
};
