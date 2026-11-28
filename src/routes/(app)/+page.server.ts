import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Studio has nothing of its own at "/": everything belongs to an organization.
export const load: PageServerLoad = async () => {
	redirect(303, '/organizations');
};
