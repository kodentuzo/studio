<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import { useSidebar } from "#lib/components/ui/sidebar/index.js";
	import { goto } from "$app/navigation";

	type Organization = { slug: string; name: string };

	let {
		organization,
		organizations,
	}: { organization: Organization; organizations: Organization[] } = $props();
	const sidebar = useSidebar();

	// The letter in the square that stands for an organization.
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
							{initial(organization.name)}
						</div>
						<div class="grid flex-1 text-start text-sm leading-tight">
							<span class="truncate font-medium">{organization.name}</span>
							<span class="truncate text-xs">Studio</span>
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
				<DropdownMenu.Label class="text-xs text-muted-foreground">Organizations</DropdownMenu.Label>
				{#each organizations as other (other.slug)}
					<DropdownMenu.Item onSelect={() => goto(`/organizations/${other.slug}`)} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border text-xs">
							{initial(other.name)}
						</div>
						<span class="truncate">{other.name}</span>
						{#if other.slug === organization.slug}
							<CheckIcon class="ms-auto size-4" />
						{/if}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => goto("/organizations/new")} class="gap-2 p-2">
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<span class="font-medium text-muted-foreground">Add organization</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
