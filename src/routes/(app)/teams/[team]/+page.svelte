<script lang="ts">
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });
</script>

<h1 class="text-2xl font-semibold">{data.current.name}</h1>

<p class="text-sm text-muted-foreground">
	{data.current.memberCount === 1 ? "1 member" : `${data.current.memberCount} members`} · made
	{dateFormat.format(data.current.createdAt)}
</p>
