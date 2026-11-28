<script lang="ts">
	import Overview from "#lib/components/overview.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });
</script>

{#if data.overview}
	<Overview
		overview={data.overview}
		projectsUrl="/teams/{data.current.slug}/projects"
		showTeam={false}
	/>
{:else}
	<h1 class="text-2xl font-semibold">{data.current.name}</h1>

	<p class="text-sm text-muted-foreground">
		{#if data.current.personal}
			Personal team
		{:else}
			{data.current.memberCount === 1 ? "1 member" : `${data.current.memberCount} members`}
		{/if}
		· made {dateFormat.format(data.current.createdAt)}
	</p>

	<div class="flex gap-2">
		<Button href="/teams/{data.current.slug}/projects" variant="outline">Projects</Button>
		{#if !data.current.personal}
			<Button href="/teams/{data.current.slug}/settings" variant="outline">Settings</Button>
		{/if}
	</div>
{/if}
