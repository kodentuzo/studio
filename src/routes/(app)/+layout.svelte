<script lang="ts">
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";
	import AppSidebar from "#lib/components/app-sidebar.svelte";
	import type { LayoutProps } from "./$types";

	let { children, data }: LayoutProps = $props();
</script>

<Sidebar.Provider>
	<AppSidebar user={data.user} team={data.team} />
	<Sidebar.Inset>
		<header
			class="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<Sidebar.Trigger class="-ms-1" />
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
