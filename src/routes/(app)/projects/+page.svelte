<script lang="ts">
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { enhance } from "$app/forms";
	import { suggestSlug } from "#lib/slug.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import * as Sheet from "#lib/components/ui/sheet/index.js";
	import ProjectTable from "#lib/components/project-table.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let open = $state(false);
	let name = $state("");
	let slug = $state("");
	// Once the slug is typed by hand, it stops following the name.
	let slugEdited = $state(false);

	// The team the new project goes in.
	let team = $state("");

	const empty = $derived(data.groups.every((group) => group.projects.length === 0));

	function startNew(inTeam?: string) {
		team = inTeam ?? data.groups[0]?.team.slug ?? "";
		name = "";
		slug = "";
		slugEdited = false;
		open = true;
	}
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Projects</h1>
	{#if data.groups.length > 0}
		<Button onclick={() => startNew()}>
			<PlusIcon data-icon="inline-start" />
			New project
		</Button>
	{/if}
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
					<Field.Label for="team">Team</Field.Label>
					<select
						id="team"
						name="team"
						required
						bind:value={team}
						class="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						{#each data.groups as group (group.team.slug)}
							<option value={group.team.slug}>{group.team.name}</option>
						{/each}
					</select>
					<Field.Description>The team the project belongs to.</Field.Description>
				</Field.Field>
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

{#if data.groups.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<AppWindowIcon />
			</Empty.Media>
			<Empty.Title>No teams yet</Empty.Title>
			<Empty.Description>
				{data.canManageTeams
					? "A project belongs to a team. Make a team first."
					: "A project belongs to a team, and you have not been added to one yet."}
			</Empty.Description>
		</Empty.Header>
		{#if data.canManageTeams}
			<Empty.Content>
				<Button variant="outline" href="/teams/new">Add team</Button>
			</Empty.Content>
		{/if}
	</Empty.Root>
{:else if empty}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<AppWindowIcon />
			</Empty.Media>
			<Empty.Title>No projects yet</Empty.Title>
			<Empty.Description>A project is an app Studio looks after.</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button variant="outline" onclick={() => startNew()}>New project</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	{#each data.groups as group (group.team.slug)}
		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-lg font-medium">
					<a href="/teams/{group.team.slug}" class="hover:underline">{group.team.name}</a>
				</h2>
				<Button variant="ghost" size="sm" onclick={() => startNew(group.team.slug)}>
					<PlusIcon data-icon="inline-start" />
					New project
				</Button>
			</div>
			{#if group.projects.length === 0}
				<p class="text-sm text-muted-foreground">No projects in this team yet.</p>
			{:else}
				<ProjectTable team={group.team} projects={group.projects} />
			{/if}
		</section>
	{/each}
{/if}
