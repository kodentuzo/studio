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
	import TeamSwitcher from "./team-switcher.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		organization,
		teams,
		team,
		canManageTeams,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
		// The organization this Studio belongs to.
		organization: { name: string };
		// The teams the person sees, and the one the switcher shows: null when there is none.
		teams: { slug: string; name: string }[];
		team: { slug: string; name: string } | null;
		// True for those who may add a team: the organization's owners and admins.
		canManageTeams: boolean;
	} = $props();

	// The overview, then the places Studio keeps things.
	// Projects belong to a team, so that link follows the team the switcher shows, and is left
	// out for someone who has no team.
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
		<TeamSwitcher {organization} {teams} {team} canAdd={canManageTeams} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		<NavProjects projects={data.projects} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
