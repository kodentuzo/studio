<script lang="ts">
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });
</script>

<h1 class="text-2xl font-semibold">{data.current.name}</h1>

<p class="text-sm text-muted-foreground">
	{data.current.memberCount === 1 ? "1 member" : `${data.current.memberCount} members`} · made
	{dateFormat.format(data.current.createdAt)}
</p>

<div class="flex gap-2">
	<Button href="/teams/{data.current.slug}/projects" variant="outline">Projects</Button>
	<Button href="/teams/{data.current.slug}/settings" variant="outline">Settings</Button>
</div>
