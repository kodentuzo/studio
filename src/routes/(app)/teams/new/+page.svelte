<script lang="ts">
	import { enhance } from "$app/forms";
	import { suggestSlug } from "#lib/slug.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { form }: PageProps = $props();

	let name = $state("");
	let slug = $state("");
	// Once the slug is typed by hand, it stops following the name.
	let slugEdited = $state(false);
	let pending = $state(false);
</script>

<h1 class="text-2xl font-semibold">Add a team</h1>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>New team</Card.Title>
		<Card.Description>
			A team is a group of people in the organization and the workspace they share.
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
					<Field.Label for="name">Name</Field.Label>
					<Input
						id="name"
						name="name"
						type="text"
						maxlength={45}
						placeholder="Web"
						required
						bind:value={name}
						oninput={() => {
							if (!slugEdited) slug = suggestSlug(name);
						}}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="slug">Slug</Field.Label>
					<Input
						id="slug"
						name="slug"
						type="text"
						maxlength={40}
						placeholder="web"
						autocapitalize="off"
						autocomplete="off"
						spellcheck={false}
						required
						bind:value={slug}
						oninput={() => (slugEdited = true)}
					/>
					<Field.Description>
						The short name in the team's address: /teams/{slug || "web"}. Lowercase letters, digits
						and hyphens. It cannot be changed later.
					</Field.Description>
				</Field.Field>
				<Field.Field>
					{#if form?.error}
						<Field.Error>{form.error}</Field.Error>
					{/if}
					<div>
						<Button type="submit" disabled={pending}>Add team</Button>
					</div>
				</Field.Field>
			</Field.Group>
		</form>
	</Card.Content>
</Card.Root>
