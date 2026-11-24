import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { fileInfo } from '#lib/server/files.js';
import { imageSize } from '#lib/server/images.js';
import { checkIconSize, isHttpsUrl, isProjectLinkKey, PROJECT_LINKS } from '#lib/project.js';
import type { Actions, PageServerLoad } from './$types';

const COLOR = /^#[0-9a-fA-F]{6}$/;

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db.select().from(projects).where(eq(projects.slug, params.slug));
	if (!project) error(404, 'That project does not exist.');

	return { project };
};

export const actions: Actions = {
	// Saves the branding fields. An emptied optional field is stored as "not set".
	save: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const shortName = String(form.get('shortName') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const themeColor = String(form.get('themeColor') ?? '').trim();
		const backgroundColor = String(form.get('backgroundColor') ?? '').trim();
		const iconPath = String(form.get('iconPath') ?? '');

		const refuse = (message: string) => fail(400, { action: 'save', error: message });

		if (!name) return refuse('Give the project a name.');
		if (name.length > 45) return refuse('The name can be at most 45 characters.');
		if (shortName.length > 12) return refuse('The short name can be at most 12 characters.');
		if (description.length > 300) {
			return refuse('The description can be at most 300 characters.');
		}
		if (themeColor && !COLOR.test(themeColor)) {
			return refuse('The theme colour has to look like #2a78d6.');
		}
		if (backgroundColor && !COLOR.test(backgroundColor)) {
			return refuse('The background colour has to look like #ffffff.');
		}

		// The icon is optional. If one is named, it has to be an image in the files folder.
		if (iconPath) {
			const info = await fileInfo(iconPath);
			if (!info) return refuse('The icon file does not exist any more. Upload it again.');
			if (!info.contentType.startsWith('image/')) {
				return refuse('The icon has to be an image: PNG, JPEG or WebP.');
			}

			const size = await imageSize(iconPath);
			if (!size) return refuse('The icon could not be read as an image.');

			const problem = checkIconSize(size.width, size.height);
			if (problem) return refuse(problem);
		}

		const [saved] = await db
			.update(projects)
			.set({
				name,
				shortName: shortName || null,
				description: description || null,
				themeColor: themeColor ? themeColor.toLowerCase() : null,
				backgroundColor: backgroundColor ? backgroundColor.toLowerCase() : null,
				iconPath: iconPath || null,
				updatedAt: new Date()
			})
			.where(eq(projects.slug, params.slug))
			.returning({ id: projects.id });

		if (!saved) error(404, 'That project does not exist.');

		return { saved: true };
	},

	// Saves the named links. A link left empty is dropped, so `urls` only holds what is set.
	saveLinks: async ({ request, params }) => {
		const form = await request.formData();
		const refuse = (message: string) => fail(400, { action: 'saveLinks', error: message });

		const urls: Record<string, string> = {};

		for (const [field, raw] of form.entries()) {
			if (!field.startsWith('url.')) continue;

			const key = field.slice('url.'.length);
			if (!isProjectLinkKey(key)) return refuse(`"${key}" is not a kind of link Studio knows.`);

			const value = String(raw).trim();
			if (!value) continue;

			if (!isHttpsUrl(value)) {
				const label = PROJECT_LINKS.find((link) => link.key === key)?.label ?? key;
				return refuse(`${label} has to be a full address starting with https://.`);
			}
			urls[key] = value;
		}

		const [saved] = await db
			.update(projects)
			.set({ urls, updatedAt: new Date() })
			.where(eq(projects.slug, params.slug))
			.returning({ id: projects.id });

		if (!saved) error(404, 'That project does not exist.');

		return { savedLinks: true };
	}
};
