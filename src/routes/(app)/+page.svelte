<script lang="ts">
	import Overview from "#lib/components/overview.svelte";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<Overview overview={data.overview} projectsUrl={data.projectsUrl} showTeam={data.showTeam} />
