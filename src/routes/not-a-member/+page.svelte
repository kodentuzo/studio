<script lang="ts">
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import { goto } from "$app/navigation";
	import { authClient } from "#lib/auth-client.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	async function signOut() {
		await authClient.signOut();
		await goto("/auth/sign-in", { invalidateAll: true });
	}
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<div class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CassetteTapeIcon class="size-4" />
			</div>
			Studio
		</div>
		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">You are not a member</Card.Title>
				<Card.Description>
					This Studio belongs to {data.organization}, and {data.email} is not part of it. Ask
					one of its owners for an invitation, then open the link they send you.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button variant="outline" class="w-full" onclick={signOut}>Sign out</Button>
			</Card.Content>
		</Card.Root>
	</div>
</div>
