<script lang="ts">
	import UsersIcon from "@lucide/svelte/icons/users";
	import * as Empty from "#lib/components/ui/empty/index.js";
</script>

<Empty.Root>
	<Empty.Header>
		<Empty.Media variant="icon">
			<UsersIcon />
		</Empty.Media>
		<Empty.Title>No teams</Empty.Title>
		<Empty.Description>Everything in Studio belongs to a team, and there is none yet.</Empty.Description>
	</Empty.Header>
</Empty.Root>
