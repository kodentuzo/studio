<script lang="ts">
	import { enhance } from "$app/forms";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
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

	// Deleting asks for the team's slug, typed out.
	let deleteOpen = $state(false);
	let typedSlug = $state("");
	let deleting = $state(false);
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

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Delete team</Card.Title>
		<Card.Description>
			Deletes the team with its projects, transactions, documents and files. This cannot be undone.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<Button
			variant="destructive"
			onclick={() => {
				typedSlug = "";
				deleteOpen = true;
			}}
		>
			Delete team
		</Button>
	</Card.Content>
</Card.Root>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {data.settings.name}?</AlertDialog.Title>
			<AlertDialog.Description>
				Its projects, transactions, documents and files are deleted with it. This cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<form
			method="POST"
			action="?/delete"
			class="flex flex-col gap-6"
			use:enhance={() => {
				deleting = true;
				return async ({ update }) => {
					await update({ reset: false });
					deleting = false;
				};
			}}
		>
			<Field.Field>
				<Field.Label for="delete-slug">
					Type the team's slug, {data.settings.slug}, to confirm
				</Field.Label>
				<Input
					id="delete-slug"
					name="slug"
					type="text"
					autocapitalize="off"
					autocomplete="off"
					spellcheck={false}
					placeholder={data.settings.slug}
					bind:value={typedSlug}
				/>
				{#if form?.action === "delete" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Field>
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action
					type="submit"
					variant="destructive"
					disabled={deleting || typedSlug.trim() !== data.settings.slug}
				>
					Delete team
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
