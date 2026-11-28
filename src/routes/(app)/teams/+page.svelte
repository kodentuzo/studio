<script lang="ts">
	import PlusIcon from "@lucide/svelte/icons/plus";
	import UsersRoundIcon from "@lucide/svelte/icons/users-round";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Teams</h1>
	{#if data.canManage}
		<Button href="/teams/new">
			<PlusIcon data-icon="inline-start" />
			Add team
		</Button>
	{/if}
</div>

{#if data.teams.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<UsersRoundIcon />
			</Empty.Media>
			<Empty.Title>No teams yet</Empty.Title>
			<Empty.Description>
				{data.canManage
					? "A team is a group of people and the projects they work on."
					: "You have not been added to a team yet. An owner or an admin can add you."}
			</Empty.Description>
		</Empty.Header>
		{#if data.canManage}
			<Empty.Content>
				<Button variant="outline" href="/teams/new">Add team</Button>
			</Empty.Content>
		{/if}
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Slug</Table.Head>
				<Table.Head class="text-end">Members</Table.Head>
				<Table.Head class="text-end">Projects</Table.Head>
				<Table.Head>Made</Table.Head>
				<Table.Head class="w-0"><span class="sr-only">Settings</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.teams as team (team.slug)}
				<Table.Row>
					<Table.Cell class="font-medium">
						<a href="/teams/{team.slug}/projects" class="hover:underline">{team.name}</a>
					</Table.Cell>
					<Table.Cell class="text-muted-foreground">{team.slug}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{team.members}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{team.projects}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{dateFormat.format(team.createdAt)}</Table.Cell>
					<Table.Cell>
						<Button variant="ghost" size="sm" href="/teams/{team.slug}/settings">Settings</Button>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
