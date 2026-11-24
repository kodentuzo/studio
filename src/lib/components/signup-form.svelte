<script lang="ts">
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { cn } from "#lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import { goto } from "$app/navigation";
	import { authClient } from "#lib/auth-client.js";

	let { class: className, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();

	let name = $state("");
	let email = $state("");
	let password = $state("");
	let confirmPassword = $state("");
	let error = $state("");
	let pending = $state(false);

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		error = "";

		if (password !== confirmPassword) {
			error = "The passwords do not match.";
			return;
		}

		pending = true;

		const result = await authClient.signUp.email({ name, email, password });

		pending = false;

		if (result.error) {
			error = result.error.message ?? "Could not create the account.";
			return;
		}

		// Signing up also signs in. Reload the server data, so the guard sees the session.
		await goto("/", { invalidateAll: true });
	}
</script>

<div class={cn("flex flex-col gap-6", className)} {...restProps}>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Create your account</Card.Title>
			<Card.Description>Enter your email below to create your account</Card.Description>
		</Card.Header>
		<Card.Content>
			<form {onsubmit}>
				<Field.Group>
					<Field.Field>
						<Field.Label for="name">Full Name</Field.Label>
						<Input
							id="name"
							name="name"
							type="text"
							autocomplete="name"
							placeholder="John Doe"
							required
							bind:value={name}
						/>
					</Field.Field>
					<Field.Field>
						<Field.Label for="email">Email</Field.Label>
						<Input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							placeholder="m@example.com"
							required
							bind:value={email}
						/>
					</Field.Field>
					<Field.Field>
						<Field.Field class="grid grid-cols-2 gap-4">
							<Field.Field>
								<Field.Label for="password">Password</Field.Label>
								<Input
									id="password"
									name="password"
									type="password"
									autocomplete="new-password"
									minlength={8}
									required
									bind:value={password}
								/>
							</Field.Field>
							<Field.Field>
								<Field.Label for="confirm-password">Confirm Password</Field.Label>
								<Input
									id="confirm-password"
									name="confirm-password"
									type="password"
									autocomplete="new-password"
									minlength={8}
									required
									bind:value={confirmPassword}
								/>
							</Field.Field>
						</Field.Field>
						<Field.Description>Must be at least 8 characters long.</Field.Description>
					</Field.Field>
					<Field.Field>
						{#if error}
							<Field.Error>{error}</Field.Error>
						{/if}
						<Button type="submit" disabled={pending}>Create Account</Button>
						<Field.Description class="text-center">
							Already have an account? <a href="/auth/sign-in">Sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
	<Field.Description class="px-6 text-center">
		By clicking continue, you agree to our <a href="#/">Terms of Service</a>
		and <a href="#/">Privacy Policy</a>.
	</Field.Description>
</div>
