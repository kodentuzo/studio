<script lang="ts">
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import { mediaUrl } from "#lib/media.js";
	import * as Table from "#lib/components/ui/table/index.js";

	// The projects of one team, as a table. Each leads to the project's own page.
	let {
		team,
		projects,
	}: {
		team: { slug: string };
		projects: {
			id: string;
			slug: string;
			name: string;
			description: string | null;
			iconPath: string | null;
		}[];
	} = $props();
</script>

<Table.Root>
	<Table.Header>
		<Table.Row>
			<Table.Head>Name</Table.Head>
			<Table.Head>Slug</Table.Head>
			<Table.Head>Description</Table.Head>
		</Table.Row>
	</Table.Header>
	<Table.Body>
		{#each projects as project (project.id)}
			<Table.Row>
				<Table.Cell class="font-medium">
					<a
						href="/teams/{team.slug}/projects/{project.slug}"
						class="flex items-center gap-3 hover:underline"
					>
						{#if project.iconPath}
							<img
								src={mediaUrl(team.slug, project.iconPath)}
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
