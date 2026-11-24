<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import { enhance } from "$app/forms";
	import { callAction, fileName, fileUrl, uploadFile } from "#lib/files.js";
	import { toWebManifest } from "#lib/manifest.js";
	import {
		checkIconSource,
		ICON_MIN_SIDE,
		ICON_RECOMMENDED_SIDE,
		PROJECT_LINKS,
		REQUIRED_PROJECT_LINKS,
	} from "#lib/project.js";
	import * as Alert from "#lib/components/ui/alert/index.js";
	import * as Breadcrumb from "#lib/components/ui/breadcrumb/index.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Dialog from "#lib/components/ui/dialog/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Textarea } from "#lib/components/ui/textarea/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let name = $state("");
	let shortName = $state("");
	let description = $state("");
	let themeColor = $state("");
	let backgroundColor = $state("");
	let iconPath = $state("");

	let uploadingIcon = $state(false);
	let iconError = $state("");

	// The picked image's width and height, or null if it cannot be measured here (then the
	// server decides when the form is saved).
	async function dimensions(file: File): Promise<{ width: number; height: number } | null> {
		try {
			const bitmap = await createImageBitmap(file);
			const size = { width: bitmap.width, height: bitmap.height };
			bitmap.close();
			return size;
		} catch {
			return null;
		}
	}

	// An uploaded image that is not square, waiting to be cropped. `offset` is where the square
	// sits along the long side: 0 is the left or top end, 0.5 the centre, 1 the other end.
	let cropping = $state<{ path: string; width: number; height: number } | null>(null);
	let offset = $state(0.5);
	let cropBusy = $state(false);
	let cropError = $state("");

	// The image is drawn to fit a box this many pixels on its long side.
	const CROP_BOX = 320;
	const cropView = $derived.by(() => {
		if (!cropping) return null;
		const scale = CROP_BOX / Math.max(cropping.width, cropping.height);
		const width = Math.round(cropping.width * scale);
		const height = Math.round(cropping.height * scale);
		const side = Math.min(width, height);
		const spare = Math.max(width, height) - side;
		const wide = width > height;
		return {
			width,
			height,
			side,
			spare,
			wide,
			left: wide ? Math.round(spare * offset) : 0,
			top: wide ? 0 : Math.round(spare * offset),
		};
	});

	// Dragging the frame: remember where the pointer and the frame were when it started.
	let drag: { pointer: number; offset: number } | null = null;

	function startDrag(event: PointerEvent) {
		if (!cropView) return;
		drag = { pointer: cropView.wide ? event.clientX : event.clientY, offset };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function moveDrag(event: PointerEvent) {
		if (!drag || !cropView || cropView.spare === 0) return;
		const moved = (cropView.wide ? event.clientX : event.clientY) - drag.pointer;
		offset = Math.min(1, Math.max(0, drag.offset + moved / cropView.spare));
	}

	function nudge(event: KeyboardEvent) {
		if (!cropView) return;
		const back = cropView.wide ? "ArrowLeft" : "ArrowUp";
		const forward = cropView.wide ? "ArrowRight" : "ArrowDown";
		if (event.key !== back && event.key !== forward) return;
		event.preventDefault();
		offset = Math.min(1, Math.max(0, offset + (event.key === forward ? 0.05 : -0.05)));
	}

	async function confirmCrop() {
		if (!cropping) return;
		cropBusy = true;
		cropError = "";

		const body = new FormData();
		body.set("path", cropping.path);
		body.set("offset", String(offset));
		const result = await callAction("?/cropIcon", body);

		cropBusy = false;
		if (result.type === "success" && result.data?.cropped) {
			iconPath = String(result.data.cropped);
			cropping = null;
		} else {
			cropError =
				result.type === "failure"
					? String(result.data?.error ?? "The image could not be cropped.")
					: "The image could not be cropped.";
		}
	}

	// Closing the dialog without cropping: the uploaded image is not wanted, so remove it.
	async function cancelCrop() {
		if (!cropping) return;
		const body = new FormData();
		body.set("path", cropping.path);
		cropping = null;
		await callAction("?/discardUpload", body);
	}

	// The chosen image is stored in the project's own folder. A square one becomes the icon on
	// Save. Any other shape opens the crop dialog first.
	async function chooseIcon(file: File) {
		uploadingIcon = true;
		iconError = "";

		if (!file.type.startsWith("image/")) {
			iconError = "The icon has to be an image: PNG, JPEG or WebP.";
		} else {
			// Measured here first, so an image that can never be an icon is refused before it is
			// stored. The server checks again when cropping and when saving.
			const size = await dimensions(file);
			const problem = size ? checkIconSource(size.width, size.height) : null;

			if (problem) {
				iconError = problem;
			} else {
				const stored = await uploadFile(file, `projects/${data.project.slug}`);

				if ("error" in stored) {
					iconError = stored.error;
				} else if (size && size.width !== size.height) {
					offset = 0.5;
					cropError = "";
					cropping = { path: stored.file.path, ...size };
				} else {
					iconPath = stored.file.path;
				}
			}
		}

		uploadingIcon = false;
	}

	let saving = $state(false);
	let saved = $state(false);

	// One text box per kind of link, keyed like the project's `urls`.
	let links = $state<Record<string, string>>({});
	let savingLinks = $state(false);
	let savedLinks = $state(false);

	// What the saved branding becomes. It follows the saved project, not what is being typed.
	const manifest = $derived(JSON.stringify(toWebManifest(data.project), null, 2));

	// The links a project should have, that the saved project does not.
	const missingLinks = $derived(
		PROJECT_LINKS.filter(
			(link) => REQUIRED_PROJECT_LINKS.includes(link.key) && !data.project.urls[link.key]
		)
	);

	// The form starts from what is saved, and starts over when another project is opened. Saving
	// the same project does not reset it while you type.
	let shownId = "";
	$effect.pre(() => {
		const project = data.project;
		if (project.id === shownId) return;
		shownId = project.id;
		name = project.name;
		shortName = project.shortName ?? "";
		description = project.description ?? "";
		themeColor = project.themeColor ?? "";
		backgroundColor = project.backgroundColor ?? "";
		iconPath = project.iconPath ?? "";
		iconError = "";
		saved = false;
		links = Object.fromEntries(PROJECT_LINKS.map((link) => [link.key, project.urls[link.key] ?? ""]));
		savedLinks = false;
	});

	const COLOR = /^#[0-9a-fA-F]{6}$/;
</script>

<Dialog.Root
	open={cropping !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) cancelCrop();
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Crop to a square</Dialog.Title>
			<Dialog.Description>
				An icon has to be square. Drag the frame to choose the part to keep.
			</Dialog.Description>
		</Dialog.Header>
		{#if cropping && cropView}
			<div class="flex justify-center">
				<div
					class="relative overflow-hidden rounded-md bg-muted"
					style="width: {cropView.width}px; height: {cropView.height}px;"
				>
					<img
						src={fileUrl(cropping.path)}
						alt="Before cropping"
						class="pointer-events-none size-full select-none"
						draggable="false"
					/>
					<!-- The frame: everything outside it is dimmed by its own shadow. -->
					<div
						role="slider"
						tabindex="0"
						aria-label="Crop position"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(offset * 100)}
						class="absolute cursor-grab touch-none rounded-sm border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
						style="left: {cropView.left}px; top: {cropView.top}px; width: {cropView.side}px; height: {cropView.side}px;"
						onpointerdown={startDrag}
						onpointermove={moveDrag}
						onpointerup={() => (drag = null)}
						onpointercancel={() => (drag = null)}
						onkeydown={nudge}
					></div>
				</div>
			</div>
			<p class="text-center text-sm text-muted-foreground">
				{cropping.width} by {cropping.height} pixels, cropped to
				{Math.min(cropping.width, cropping.height)} by {Math.min(cropping.width, cropping.height)}.
			</p>
			{#if cropError}
				<p role="alert" class="text-sm text-destructive">{cropError}</p>
			{/if}
		{/if}
		<Dialog.Footer>
			<Button type="button" variant="ghost" onclick={() => (offset = 0.5)} disabled={cropBusy}>
				Centre
			</Button>
			<Button type="button" variant="outline" onclick={cancelCrop} disabled={cropBusy}>
				Cancel
			</Button>
			<Button type="button" onclick={confirmCrop} disabled={cropBusy}>
				{cropBusy ? "Cropping…" : "Crop"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Breadcrumb.Root>
	<Breadcrumb.List>
		<Breadcrumb.Item>
			<Breadcrumb.Link href="/projects">Projects</Breadcrumb.Link>
		</Breadcrumb.Item>
		<Breadcrumb.Separator />
		<Breadcrumb.Item>
			<Breadcrumb.Page>{data.project.name}</Breadcrumb.Page>
		</Breadcrumb.Item>
	</Breadcrumb.List>
</Breadcrumb.Root>

<div>
	<h1 class="text-2xl font-semibold">{data.project.name}</h1>
	<p class="text-sm text-muted-foreground">{data.project.slug}</p>
</div>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Branding</Card.Title>
		<Card.Description>What the app is called and how it looks.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-6"
			use:enhance={() => {
				saving = true;
				saved = false;
				return async ({ result, update }) => {
					await update({ reset: false });
					saving = false;
					saved = result.type === "success";
				};
			}}
		>
			<input type="hidden" name="iconPath" value={iconPath} />
			<Field.Group>
				<Field.Field>
					<Field.Label for="icon">Icon</Field.Label>
					{#if iconPath}
						<div class="flex items-center gap-3">
							<img
								src={fileUrl(iconPath)}
								alt="The project's icon"
								class="size-16 rounded-xl border object-cover"
							/>
							<span class="truncate text-sm text-muted-foreground">{fileName(iconPath)}</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="ms-auto"
								onclick={() => (iconPath = "")}
							>
								<XIcon />
								<span class="sr-only">Remove icon</span>
							</Button>
						</div>
					{:else}
						<Input
							id="icon"
							type="file"
							accept="image/png,image/jpeg,image/webp"
							disabled={uploadingIcon}
							onchange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) chooseIcon(file);
							}}
						/>
					{/if}
					{#if uploadingIcon}
						<Field.Description>Storing the image…</Field.Description>
					{:else if iconError}
						<Field.Error>{iconError}</Field.Error>
					{:else}
						<Field.Description>
							A square PNG, ideally {ICON_RECOMMENDED_SIDE} by {ICON_RECOMMENDED_SIDE} pixels and at
							least {ICON_MIN_SIDE}. Another shape can be cropped here. It is saved with the rest of
							the form.
						</Field.Description>
					{/if}
				</Field.Field>
				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input id="name" name="name" type="text" maxlength={45} required bind:value={name} />
				</Field.Field>
				<Field.Field>
					<Field.Label for="shortName">Short name</Field.Label>
					<Input
						id="shortName"
						name="shortName"
						type="text"
						maxlength={12}
						placeholder={name.slice(0, 12)}
						bind:value={shortName}
					/>
					<Field.Description>
						The label under the home-screen icon, up to 12 characters. Leave it empty to use the
						name.
					</Field.Description>
				</Field.Field>
				<Field.Field>
					<Field.Label for="description">Description</Field.Label>
					<Textarea
						id="description"
						name="description"
						maxlength={300}
						rows={3}
						bind:value={description}
					/>
					<Field.Description>{description.length} of 300 characters.</Field.Description>
				</Field.Field>
				<div class="grid gap-4 md:grid-cols-2">
					<Field.Field>
						<Field.Label for="themeColor">Theme colour</Field.Label>
						<div class="flex items-center gap-2">
							<input
								type="color"
								aria-label="Pick the theme colour"
								class="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
								value={COLOR.test(themeColor) ? themeColor : "#000000"}
								oninput={(event) => (themeColor = event.currentTarget.value)}
							/>
							<Input
								id="themeColor"
								name="themeColor"
								type="text"
								maxlength={7}
								placeholder="#2a78d6"
								autocomplete="off"
								spellcheck={false}
								bind:value={themeColor}
							/>
						</div>
						<Field.Description>The browser bar and title bar.</Field.Description>
					</Field.Field>
					<Field.Field>
						<Field.Label for="backgroundColor">Background colour</Field.Label>
						<div class="flex items-center gap-2">
							<input
								type="color"
								aria-label="Pick the background colour"
								class="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
								value={COLOR.test(backgroundColor) ? backgroundColor : "#ffffff"}
								oninput={(event) => (backgroundColor = event.currentTarget.value)}
							/>
							<Input
								id="backgroundColor"
								name="backgroundColor"
								type="text"
								maxlength={7}
								placeholder="#ffffff"
								autocomplete="off"
								spellcheck={false}
								bind:value={backgroundColor}
							/>
						</div>
						<Field.Description>The splash screen while the app loads.</Field.Description>
					</Field.Field>
				</div>
				{#if form?.action === "save" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<div class="flex items-center gap-3">
				<Button type="submit" disabled={saving}>Save</Button>
				{#if saved}
					<span class="text-sm text-muted-foreground" role="status">Saved.</span>
				{/if}
			</div>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Links</Card.Title>
		<Card.Description>Where the app and its legal pages are.</Card.Description>
	</Card.Header>
	<Card.Content class="gap-6">
		{#if missingLinks.length > 0}
			<Alert.Root>
				<Alert.Title>
					Missing: {missingLinks.map((link) => link.label.toLowerCase()).join(" and ")}
				</Alert.Title>
				<Alert.Description>
					An app that handles personal data needs both before it goes in front of people.
				</Alert.Description>
			</Alert.Root>
		{/if}
		<form
			method="POST"
			action="?/saveLinks"
			class="flex flex-col gap-6"
			use:enhance={() => {
				savingLinks = true;
				savedLinks = false;
				return async ({ result, update }) => {
					await update({ reset: false });
					savingLinks = false;
					savedLinks = result.type === "success";
				};
			}}
		>
			<Field.Group>
				{#each PROJECT_LINKS as link (link.key)}
					<Field.Field>
						<Field.Label for="url-{link.key}">{link.label}</Field.Label>
						<Input
							id="url-{link.key}"
							name="url.{link.key}"
							type="url"
							inputmode="url"
							maxlength={500}
							placeholder={link.placeholder}
							autocomplete="off"
							spellcheck={false}
							bind:value={links[link.key]}
						/>
						<Field.Description>{link.hint}</Field.Description>
					</Field.Field>
				{/each}
				{#if form?.action === "saveLinks" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<div class="flex items-center gap-3">
				<Button type="submit" disabled={savingLinks}>Save links</Button>
				{#if savedLinks}
					<span class="text-sm text-muted-foreground" role="status">Saved.</span>
				{/if}
			</div>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Web manifest</Card.Title>
		<Card.Description>
			What the saved branding becomes: the file a browser reads to install the app. It updates
			when you save.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<pre class="overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code>{manifest}</code></pre>
		{#if data.project.iconPath}
			<p class="text-sm text-muted-foreground">
				The icon entry is a placeholder. Studio does not yet make the icon files an app serves.
			</p>
		{/if}
	</Card.Content>
</Card.Root>
