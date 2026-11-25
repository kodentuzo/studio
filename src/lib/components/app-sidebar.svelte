<script lang="ts" module>
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import LibraryIcon from "@lucide/svelte/icons/library";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import RocketIcon from "@lucide/svelte/icons/rocket";
	import VaultIcon from "@lucide/svelte/icons/vault";

	// This is sample data.
	const data = {
		navMain: [
			{
				title: "Overview",
				url: "/",
				icon: LayoutDashboardIcon,
			},
			{
				title: "Projects",
				url: "/projects",
				icon: AppWindowIcon,
			},
			{
				title: "Registry",
				url: "/registry",
				icon: LibraryIcon,
			},
			{
				title: "Finances",
				url: "/finances",
				icon: WalletIcon,
			},
			{
				title: "Vault",
				url: "/vault",
				icon: VaultIcon,
			},
		],
		projects: [
			{
				name: "blog 1.4.0",
				url: "#",
				icon: RocketIcon,
			},
			{
				name: "docs 0.9.2",
				url: "#",
				icon: RocketIcon,
			},
			{
				name: "shop 2.0.1",
				url: "#",
				icon: RocketIcon,
			},
		],
	};
</script>

<script lang="ts">
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import NavMain from "./nav-main.svelte";
	import NavProjects from "./nav-projects.svelte";
	import NavUser from "./nav-user.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
	} = $props();
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<CassetteTapeIcon class="size-4" />
							</div>
							<span class="truncate font-medium">Studio</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={data.navMain} />
		<NavProjects projects={data.projects} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
