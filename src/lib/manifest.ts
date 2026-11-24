// Turns a project's branding into a web manifest: the small file a browser reads to install a
// site as an app. Fields the project has not set are left out, and a few are always the same.

export type ManifestSource = {
	name: string;
	shortName: string | null;
	description: string | null;
	themeColor: string | null;
	backgroundColor: string | null;
	iconPath: string | null;
};

export type WebManifest = {
	name: string;
	short_name: string;
	description?: string;
	start_url: string;
	scope: string;
	display: string;
	theme_color?: string;
	background_color?: string;
	icons?: { src: string; sizes: string; type: string }[];
};

export function toWebManifest(project: ManifestSource): WebManifest {
	const manifest: WebManifest = {
		name: project.name,
		// The label under the home-screen icon. Without one, the name is used.
		short_name: project.shortName || project.name,
		// The same for every project: the app opens at its front page, covers the whole site,
		// and runs in its own window.
		start_url: '/',
		scope: '/',
		display: 'standalone'
	};

	if (project.description) manifest.description = project.description;
	if (project.themeColor) manifest.theme_color = project.themeColor;
	if (project.backgroundColor) manifest.background_color = project.backgroundColor;

	// The address is on the app's own site, not in Studio: the manifest is served by the app.
	if (project.iconPath) {
		manifest.icons = [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }];
	}

	return manifest;
}
