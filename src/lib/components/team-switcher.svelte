<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import { useSidebar } from "#lib/components/ui/sidebar/index.js";
	import { goto } from "$app/navigation";

	type Team = { slug: string; name: string };

	let {
		organization,
		teams,
		team,
		canAdd,
	}: {
		// The organization this Studio belongs to: always the same, shown under the team.
		organization: { name: string };
		// The teams the person sees, and the one shown as current: null when there is none.
		teams: Team[];
		team: Team | null;
		// True for those who may add a team.
		canAdd: boolean;
	} = $props();
	const sidebar = useSidebar();

	// The letter in the square that stands for a team.
	function initial(name: string) {
		return name.trim()[0]?.toUpperCase() ?? "?";
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuButton
						{...props}
						size="lg"
						class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					>
						<div
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-medium text-sidebar-primary-foreground"
						>
							{initial((team ?? organization).name)}
						</div>
						<div class="grid flex-1 text-start text-sm leading-tight">
							<span class="truncate font-medium">{team ? team.name : "No team"}</span>
							<span class="truncate text-xs">{organization.name}</span>
						</div>
						<ChevronsUpDownIcon class="ms-auto" />
					</Sidebar.MenuButton>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
				align="start"
				side={sidebar.isMobile ? "bottom" : "right"}
				sideOffset={4}
			>
				<DropdownMenu.Label class="text-xs text-muted-foreground">Teams</DropdownMenu.Label>
				{#each teams as other (other.slug)}
					<DropdownMenu.Item onSelect={() => goto(`/teams/${other.slug}`)} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border text-xs">
							{initial(other.name)}
						</div>
						<span class="truncate">{other.name}</span>
						{#if other.slug === team?.slug}
							<CheckIcon class="ms-auto size-4" />
						{/if}
					</DropdownMenu.Item>
				{/each}
				{#if teams.length === 0}
					<div class="p-2 text-sm text-muted-foreground">
						{canAdd ? "There are no teams yet." : "You have not been added to a team yet."}
					</div>
				{/if}
				{#if canAdd}
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => goto("/teams/new")} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
							<PlusIcon class="size-4" />
						</div>
						<span class="font-medium text-muted-foreground">Add team</span>
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
