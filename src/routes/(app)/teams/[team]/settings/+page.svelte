<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	// Starts as the saved name, and follows it again after each save.
	let name = $derived(data.settings.name);
	let saving = $state(false);
	let saved = $state(false);

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });
</script>

<h1 class="text-2xl font-semibold">Settings</h1>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>General</Card.Title>
		<Card.Description>How the team is named and where it lives.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form
			method="POST"
			action="?/general"
			class="flex flex-col gap-6"
			use:enhance={() => {
				saving = true;
				saved = false;
				return async ({ result, update }) => {
					await update({ reset: false });
					saving = false;
					saved = result.type === "success";
				};
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input
						id="name"
						name="name"
						type="text"
						maxlength={45}
						required
						bind:value={name}
						oninput={() => (saved = false)}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="slug">Slug</Field.Label>
					<Input id="slug" type="text" value={data.settings.slug} readonly disabled />
					<Field.Description>
						The team's address is /teams/{data.settings.slug}. It cannot be changed.
					</Field.Description>
				</Field.Field>
				<Field.Field>
					<Field.Label>Created</Field.Label>
					<p class="text-sm text-muted-foreground">
						{dateFormat.format(data.settings.createdAt)}
					</p>
				</Field.Field>
				{#if form?.action === "general" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<div class="flex items-center gap-3">
				<Button type="submit" disabled={saving}>Save</Button>
				{#if saved}
					<span class="text-sm text-muted-foreground">Saved</span>
				{/if}
			</div>
		</form>
	</Card.Content>
</Card.Root>
