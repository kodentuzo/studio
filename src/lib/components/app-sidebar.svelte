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
	import OrganizationSwitcher from "./organization-switcher.svelte";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		organization,
		organizations,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
		// The organization the links lead into, or null when there is no organization at all.
		organization: { slug: string; name: string } | null;
		// Every organization, for the switcher at the top.
		organizations: { slug: string; name: string }[];
	} = $props();

	// The organization's overview, then the places it keeps things.
	const navMain = $derived.by(() => {
		if (!organization) return [];
		const base = `/organizations/${organization.slug}`;
		return [
			{ title: "Overview", url: base, icon: LayoutDashboardIcon },
			{ title: "Projects", url: `${base}/projects`, icon: AppWindowIcon },
			{ title: "Finances", url: `${base}/finances`, icon: WalletIcon },
			{ title: "Settings", url: `${base}/settings`, icon: SettingsIcon },
		];
	});
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		{#if organization}
			<OrganizationSwitcher {organization} {organizations} />
		{/if}
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
