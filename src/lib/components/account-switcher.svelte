<script lang="ts">
	import Building2Icon from "@lucide/svelte/icons/building-2";
	import CheckIcon from "@lucide/svelte/icons/check";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import UserRoundIcon from "@lucide/svelte/icons/user-round";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import { useSidebar } from "#lib/components/ui/sidebar/index.js";
	import { goto } from "$app/navigation";

	// The same switcher the account pages have: the person, and the organization.
	// One flat list. The icon on each row says which kind it is.
	// Here it switches what Studio shows: the person's own team with their own projects, or
	// what belongs to the organization. It never leaves Studio; the foot of the sidebar leads
	// to the account pages.
	let {
		user,
		organization,
		personalTeam,
		inPersonal,
	}: {
		user: { name: string };
		organization: { slug: string; name: string };
		// The person's own team, and whether that is where they are.
		personalTeam: { slug: string };
		inPersonal: boolean;
	} = $props();
	const sidebar = useSidebar();
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
							class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
						>
							{#if inPersonal}
								<UserRoundIcon class="size-4" />
							{:else}
								<Building2Icon class="size-4" />
							{/if}
						</div>
						<div class="grid flex-1 text-start text-sm leading-tight">
							<span class="truncate font-medium">
								{inPersonal ? user.name : organization.name}
							</span>
							<span class="truncate text-xs">
								@{inPersonal ? personalTeam.slug : organization.slug}
							</span>
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
				<DropdownMenu.Item
					onSelect={() => goto(`/teams/${personalTeam.slug}/projects`)}
					class="gap-2 p-2"
				>
					<div class="flex size-6 items-center justify-center rounded-md border">
						<UserRoundIcon class="size-3.5" />
					</div>
					<span class="truncate">{user.name}</span>
					{#if inPersonal}
						<CheckIcon class="ms-auto size-4" />
					{/if}
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => goto("/")} class="gap-2 p-2">
					<div class="flex size-6 items-center justify-center rounded-md border">
						<Building2Icon class="size-3.5" />
					</div>
					<span class="truncate">{organization.name}</span>
					{#if !inPersonal}
						<CheckIcon class="ms-auto size-4" />
					{/if}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
