<script lang="ts">
	import Finances from "#lib/components/finances.svelte";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
</script>

<Finances {data} {form} />
