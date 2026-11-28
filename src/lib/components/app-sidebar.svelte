<script lang="ts" module>
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import UsersRoundIcon from "@lucide/svelte/icons/users-round";
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
		personalTeam,
		inPersonal,
		authUrl,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
		// The organization this Studio belongs to.
		organization: { slug: string; name: string };
		// The person's own team, and whether that is where they are.
		personalTeam: { slug: string; name: string };
		inPersonal: boolean;
		// Where the account service is reached.
		authUrl: string;
	} = $props();

	// The overview, then the places Studio keeps things.
	// The organization's projects are listed in one place, team by team.
	//
	// In the person's own team there is what is theirs: their projects and their finances.
	const navMain = $derived(
		inPersonal
			? [
					{
						title: "Projects",
						url: `/teams/${personalTeam.slug}/projects`,
						icon: AppWindowIcon,
					},
					{
						title: "Finances",
						url: `/teams/${personalTeam.slug}/finances`,
						icon: WalletIcon,
					},
				]
			: [
					{ title: "Overview", url: "/", icon: LayoutDashboardIcon },
					{ title: "Projects", url: "/projects", icon: AppWindowIcon },
					{ title: "Teams", url: "/teams", icon: UsersRoundIcon },
					{ title: "Finances", url: "/finances", icon: WalletIcon },
					{ title: "Settings", url: "/settings", icon: SettingsIcon },
				]
	);
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<AccountSwitcher {user} {organization} {personalTeam} {inPersonal} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		{#if !inPersonal}
			<NavProjects projects={data.projects} />
		{/if}
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} {authUrl} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
