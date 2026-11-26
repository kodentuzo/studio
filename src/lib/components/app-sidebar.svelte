<script lang="ts" module>
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import AppWindowIcon from "@lucide/svelte/icons/app-window";
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
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		collapsible = "icon",
		user,
		team,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		user: ComponentProps<typeof NavUser>["user"];
		// The team the links lead into, or null when there is no team at all.
		team: { slug: string; name: string } | null;
	} = $props();

	// Only the places a team keeps things. The team's overview is where "Studio" at the top leads.
	const navMain = $derived.by(() => {
		if (!team) return [];
		const base = `/teams/${team.slug}`;
		return [
			{ title: "Projects", url: `${base}/projects`, icon: AppWindowIcon },
			{ title: "Finances", url: `${base}/finances`, icon: WalletIcon },
			{ title: "Settings", url: `${base}/settings`, icon: SettingsIcon },
		];
	});
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href={team ? `/teams/${team.slug}` : "/"} {...props}>
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
		<NavMain items={navMain} />
		<NavProjects projects={data.projects} />
	</Sidebar.Content>
	<Sidebar.Footer>
		<NavUser {user} />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
