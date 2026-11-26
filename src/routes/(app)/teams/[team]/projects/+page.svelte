<script lang="ts">
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { enhance } from "$app/forms";
	import { mediaUrl } from "#lib/media.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import * as Sheet from "#lib/components/ui/sheet/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let open = $state(false);
	let name = $state("");
	let slug = $state("");
	// Once the slug is typed by hand, it stops following the name.
	let slugEdited = $state(false);

	// "My Blog!" becomes "my-blog".
	function suggestSlug(value: string) {
		return value
			.toLowerCase()
			.normalize("NFKD")
			// Drop accents, so "crêpe" becomes "crepe" and not "cre-pe".
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40)
			.replace(/-+$/, "");
	}

	function startNew() {
		name = "";
		slug = "";
		slugEdited = false;
		open = true;
	}
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Projects</h1>
	<Button onclick={startNew}>
		<PlusIcon data-icon="inline-start" />
		New project
	</Button>
</div>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>New project</Sheet.Title>
			<Sheet.Description>An app Studio looks after. The rest can be filled in later.</Sheet.Description>
		</Sheet.Header>
		<form
			method="POST"
			action="?/create"
			class="flex flex-col gap-6 px-4 pb-4"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === "success") open = false;
				}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input
						id="name"
						name="name"
						type="text"
						maxlength={45}
						placeholder="Sokoban"
						required
						bind:value={name}
						oninput={() => {
							if (!slugEdited) slug = suggestSlug(name);
						}}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="slug">Slug</Field.Label>
					<Input
						id="slug"
						name="slug"
						type="text"
						maxlength={40}
						placeholder="sokoban"
						autocapitalize="off"
						autocomplete="off"
						spellcheck={false}
						required
						bind:value={slug}
						oninput={() => (slugEdited = true)}
					/>
					<Field.Description>
						The short name used in addresses. Lowercase letters, digits and hyphens.
					</Field.Description>
				</Field.Field>
				{#if form?.action === "create" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit">Create project</Button>
			</div>
		</form>
	</Sheet.Content>
</Sheet.Root>

{#if data.projects.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<AppWindowIcon />
			</Empty.Media>
			<Empty.Title>No projects yet</Empty.Title>
			<Empty.Description>A project is an app Studio looks after.</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button variant="outline" onclick={startNew}>New project</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Slug</Table.Head>
				<Table.Head>Description</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.projects as project (project.id)}
				<Table.Row>
					<Table.Cell class="font-medium">
						<a
							href="/teams/{data.team.slug}/projects/{project.slug}"
							class="flex items-center gap-3 hover:underline"
						>
							{#if project.iconPath}
								<img
									src={mediaUrl(data.team.slug, project.iconPath)}
									alt=""
									class="size-8 rounded-lg border object-cover"
								/>
							{:else}
								<span
									class="flex size-8 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
								>
									<AppWindowIcon class="size-4" />
								</span>
							{/if}
							{project.name}
						</a>
					</Table.Cell>
					<Table.Cell class="text-muted-foreground">{project.slug}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{project.description ?? ""}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
