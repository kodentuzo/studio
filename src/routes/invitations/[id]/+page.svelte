<script lang="ts">
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import { enhance } from "$app/forms";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	const ROLE_NAMES: Record<string, string> = { owner: "an owner", admin: "an admin", member: "a member" };
	let pending = $state(false);
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CassetteTapeIcon class="size-4" />
			</div>
			Studio
		</a>
		<Card.Root>
			{#if data.invitation}
				<Card.Header class="text-center">
					<Card.Title class="text-xl">Join {data.invitation.organization}</Card.Title>
					<Card.Description>
						{data.invitation.inviter} invited you to join {data.invitation.organization} as
						{ROLE_NAMES[data.invitation.role] ?? data.invitation.role}.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						class="flex flex-col gap-3"
						use:enhance={() => {
							pending = true;
							return async ({ update }) => {
								await update();
								pending = false;
							};
						}}
					>
						{#if form?.error}
							<Field.Error>{form.error}</Field.Error>
						{/if}
						<Button type="submit" formaction="?/accept" disabled={pending}>Accept</Button>
						<Button type="submit" formaction="?/decline" variant="outline" disabled={pending}>
							Decline
						</Button>
					</form>
				</Card.Content>
			{:else}
				<Card.Header class="text-center">
					<Card.Title class="text-xl">This invitation cannot be used</Card.Title>
					<Card.Description>
						It was made for another email address than {data.email}, or it has expired, been
						cancelled or already been answered.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button href="/" variant="outline" class="w-full">Go to Studio</Button>
				</Card.Content>
			{/if}
		</Card.Root>
	</div>
</div>
