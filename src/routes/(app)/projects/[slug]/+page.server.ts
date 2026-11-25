import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { projects } from '#lib/server/db/schema.js';
import { isFileUsed } from '#lib/server/file-uses.js';
import { fileInfo, removeFile, saveUpload } from '#lib/server/media.js';
import { cropToSquare, imageSize } from '#lib/server/images.js';
import {
	checkIconSize,
	checkIconSource,
	isHttpsUrl,
	isProjectLinkKey,
	PROJECT_LINKS
} from '#lib/project.js';
import type { Actions, PageServerLoad } from './$types';

const COLOR = /^#[0-9a-fA-F]{6}$/;

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db.select().from(projects).where(eq(projects.slug, params.slug));
	if (!project) error(404, 'That project does not exist.');

	return { project };
};

/** The project's own folder in the media folder. Icon uploads live here. */
function projectFolder(slug: string) {
	return `projects/${slug}`;
}

/** True for a path directly inside the project's folder: the only files these actions touch. */
function isInProjectFolder(path: string, slug: string) {
	const folder = `${projectFolder(slug)}/`;
	return path.startsWith(folder) && !path.slice(folder.length).includes('/');
}

export const actions: Actions = {
	// Cuts an uploaded image down to a square and stores the result as a new PNG. The picked
	// image is then removed, unless something uses it. Returns the new file's path.
	cropIcon: async ({ request, params }) => {
		const form = await request.formData();
		const path = String(form.get('path') ?? '');
		const offset = Number(form.get('offset') ?? '0.5');
		const refuse = (message: string) => fail(400, { action: 'cropIcon', error: message });

		if (!isInProjectFolder(path, params.slug)) return refuse('That image is not in this project.');
		if (!Number.isFinite(offset) || offset < 0 || offset > 1) {
			return refuse('That crop position is not valid.');
		}

		// Too small to give a big enough square, or too large to open: say so before cutting.
		const size = await imageSize(path);
		if (!size) return refuse('The image could not be read.');
		const problem = checkIconSource(size.width, size.height);
		if (problem) return refuse(problem);

		const bytes = await cropToSquare(path, offset);
		if (!bytes) return refuse('The image could not be read.');

		const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]*$/, '');
		const stored = await saveUpload(
			new File([bytes], `${name}-square.png`, { type: 'image/png' }),
			projectFolder(params.slug)
		);
		if ('error' in stored) return refuse(stored.error);

		if (!(await isFileUsed(path))) await removeFile(path);

		return { cropped: stored.path };
	},

	// Removes an image that was uploaded for cropping and then not used.
	discardUpload: async ({ request, params }) => {
		const form = await request.formData();
		const path = String(form.get('path') ?? '');

		if (isInProjectFolder(path, params.slug) && !(await isFileUsed(path))) {
			await removeFile(path);
		}

		return { discarded: true };
	},

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

		// The icon is optional. If one is named, it has to be an image in the media folder.
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
