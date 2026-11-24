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
			<Card.Title class="text-xl">Forgot your password?</Card.Title>
			<Card.Description>Enter your email and we'll send you a link to reset it</Card.Description>
		</Card.Header>
		<Card.Content>
			<form>
				<Field.Group>
					<Field.Field>
						<Field.Label for="email-{id}">Email</Field.Label>
						<Input id="email-{id}" type="email" placeholder="m@example.com" required />
					</Field.Field>
					<Field.Field>
						<Button type="submit">Send reset link</Button>
						<Field.Description class="text-center">
							Remembered it? <a href="/auth/sign-in">Back to sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
</div>
