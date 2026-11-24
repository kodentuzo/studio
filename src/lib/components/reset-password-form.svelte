<script lang="ts">
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { cn } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	const id = $props.id();
</script>

<div class={cn("flex flex-col gap-6", className)} {...restProps}>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Reset your password</Card.Title>
			<Card.Description>Enter a new password for your account</Card.Description>
		</Card.Header>
		<Card.Content>
			<form>
				<Field.Group>
					<Field.Field>
						<Field.Label for="password-{id}">New password</Field.Label>
						<Input id="password-{id}" type="password" required />
						<Field.Description>Must be at least 8 characters long.</Field.Description>
					</Field.Field>
					<Field.Field>
						<Field.Label for="confirm-password-{id}">Confirm password</Field.Label>
						<Input id="confirm-password-{id}" type="password" required />
					</Field.Field>
					<Field.Field>
						<Button type="submit">Reset password</Button>
						<Field.Description class="text-center">
							<a href="/auth/sign-in">Back to sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
</div>
