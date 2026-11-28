<script lang="ts">
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import { enhance } from "$app/forms";
	import { dev } from "$app/env";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { form }: PageProps = $props();

	let name = $state("");
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
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Set up this Studio</Card.Title>
				<Card.Description>
					Name the organization this Studio belongs to. You become its owner.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form
					method="POST"
					action="?/create"
					use:enhance={() => {
						pending = true;
						return async ({ update }) => {
							await update({ reset: false });
							pending = false;
						};
					}}
				>
					<Field.Group>
						<Field.Field>
							<Field.Label for="name">Organization name</Field.Label>
							<Input
								id="name"
								name="name"
								type="text"
								maxlength={45}
								placeholder="Acme"
								required
								bind:value={name}
							/>
						</Field.Field>
						<Field.Field>
							{#if form?.error}
								<Field.Error>{form.error}</Field.Error>
							{/if}
							<Button type="submit" disabled={pending}>Set up</Button>
						</Field.Field>
					</Field.Group>
				</form>
			</Card.Content>
		</Card.Root>
		{#if dev}
			<Field.Description class="px-6 text-center">
				In development, <code>pnpm db:seed</code> sets Studio up with some sample data.
			</Field.Description>
		{/if}
	</div>
</div>
