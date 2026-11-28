<script lang="ts" module>
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import RocketIcon from "@lucide/svelte/icons/rocket";
	import SettingsIcon from "@lucide/svelte/icons/settings";

	// This is sample data.
	const data = {
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
	import AccountSwitcher from "./account-switcher.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		organization,
		team,
		authUrl,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
		// The organization this Studio belongs to.
		organization: { slug: string; name: string };
		// The team the Projects link follows: null when the person has none.
		team: { slug: string; name: string } | null;
		// Where the account service is reached.
		authUrl: string;
	} = $props();

	// The overview, then the places Studio keeps things.
	// Projects belong to a team, so that link follows the team in the address, or else the
	// oldest, and is left out for someone who has no team.
	const navMain = $derived([
		{ title: "Overview", url: "/", icon: LayoutDashboardIcon },
		...(team
			? [{ title: "Projects", url: `/teams/${team.slug}/projects`, icon: AppWindowIcon }]
			: []),
		{ title: "Finances", url: "/finances", icon: WalletIcon },
		{ title: "Settings", url: "/settings", icon: SettingsIcon },
	]);
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<AccountSwitcher {user} {organization} {authUrl} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		<NavProjects projects={data.projects} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} {authUrl} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
