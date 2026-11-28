<script lang="ts" module>
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import UsersRoundIcon from "@lucide/svelte/icons/users-round";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import SettingsIcon from "@lucide/svelte/icons/settings";

</script>

<script lang="ts">
	import { page } from "$app/state";
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import NavMain from "./nav-main.svelte";
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
	//
	// In the person's own team there is what is theirs: their projects and their finances.
	// The link for the page being looked at is marked. A project's own page is under its team's
	// address, so in the organization everything under a team's projects counts as Projects, and
	// the rest under /teams as Teams.
	const navMain = $derived.by(() => {
		const path = page.url.pathname;
		const under = (url: string) => path === url || path.startsWith(`${url}/`);

		if (inPersonal) {
			const base = `/teams/${personalTeam.slug}`;
			return [
				{ title: "Overview", url: base, icon: LayoutDashboardIcon, isActive: path === base },
				{
					title: "Projects",
					url: `${base}/projects`,
					icon: AppWindowIcon,
					isActive: under(`${base}/projects`),
				},
				{
					title: "Finances",
					url: `${base}/finances`,
					icon: WalletIcon,
					isActive: under(`${base}/finances`),
				},
			];
		}

		const inProjects = under("/projects") || /^\/teams\/[^/]+\/projects(\/|$)/.test(path);
		return [
			{ title: "Overview", url: "/", icon: LayoutDashboardIcon, isActive: path === "/" },
			{ title: "Projects", url: "/projects", icon: AppWindowIcon, isActive: inProjects },
			{ title: "Finances", url: "/finances", icon: WalletIcon, isActive: under("/finances") },
			{
				title: "Teams",
				url: "/teams",
				icon: UsersRoundIcon,
				isActive: under("/teams") && !inProjects,
			},
			{ title: "Settings", url: "/settings", icon: SettingsIcon, isActive: under("/settings") },
		];
	});
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<AccountSwitcher {user} {organization} {personalTeam} {inPersonal} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain label={inPersonal ? "Your space" : "Organization"} items={navMain} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} {authUrl} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
