<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Breadcrumb from "#lib/components/ui/breadcrumb/index.js";
	import * as Card from "#lib/components/ui/card/index.js";
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

	let saving = $state(false);
	let saved = $state(false);

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
		saved = false;
	});

	const COLOR = /^#[0-9a-fA-F]{6}$/;
</script>

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
			<Field.Group>
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
