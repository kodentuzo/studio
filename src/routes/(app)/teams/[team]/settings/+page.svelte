<script lang="ts">
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { callAction } from "#lib/media.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	// Starts as the saved name, and follows it again after each save.
	let name = $derived(data.settings.name);
	let saving = $state(false);
	let saved = $state(false);

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

	// Members: adding one, and the one being removed while that is confirmed.
	type Member = (typeof data.members)[number];
	let adding = $state(false);
	let removing = $state<Member | null>(null);
	let membersBusy = $state(false);
	let membersError = $state("");

	async function removeMember(member: Member) {
		membersBusy = true;
		membersError = "";
		const body = new FormData();
		body.set("userId", member.id);

		const result = await callAction("?/removeMember", body);
		if (result.type === "failure") {
			membersError = String(result.data?.error ?? "That could not be done.");
		} else if (result.type === "error") {
			membersError = result.error?.message ?? "That could not be done.";
		}
		await invalidateAll();
		membersBusy = false;
	}

	// Deleting asks for the team's slug, typed out.
	let deleteOpen = $state(false);
	let typedSlug = $state("");
	let deleting = $state(false);
</script>

<h1 class="text-2xl font-semibold">Team settings</h1>

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
						disabled={!data.canManage}
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
			{#if data.canManage}
				<div class="flex items-center gap-3">
					<Button type="submit" disabled={saving}>Save</Button>
					{#if saved}
						<span class="text-sm text-muted-foreground">Saved</span>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">
					Only an owner or an admin of the organization can change these.
				</p>
			{/if}
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Members</Card.Title>
		<Card.Description>
			The people in this team. The organization's owners and admins see every team without
			being in it.
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if data.members.length === 0}
			<p class="text-sm text-muted-foreground">Nobody is in this team yet.</p>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Added</Table.Head>
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.members as member (member.id)}
						<Table.Row>
							<Table.Cell>
								<div class="font-medium">
									{member.name}
									{#if member.isYou}
										<span class="font-normal text-muted-foreground">(you)</span>
									{/if}
								</div>
								<div class="text-sm text-muted-foreground">{member.email}</div>
							</Table.Cell>
							<Table.Cell class="text-muted-foreground">
								{member.joined ? dateFormat.format(member.joined) : ""}
							</Table.Cell>
							<Table.Cell class="text-end">
								{#if data.canManage}
									<Button
										variant="ghost"
										size="sm"
										disabled={membersBusy}
										onclick={() => (removing = member)}
									>
										Remove
									</Button>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
		{#if membersError}
			<Field.Error>{membersError}</Field.Error>
		{/if}

		{#if data.canManage}
			<form
				method="POST"
				action="?/addMember"
				class="flex flex-col gap-2"
				use:enhance={() => {
					adding = true;
					return async ({ update }) => {
						await update();
						adding = false;
					};
				}}
			>
				<Field.Label for="add-member">Add someone</Field.Label>
				{#if data.addable.length === 0}
					<p class="text-sm text-muted-foreground">
						Everyone in the organization is already in this team. Invite new people from the
						organization's settings.
					</p>
				{:else}
					<div class="flex flex-wrap gap-2">
						<select
							id="add-member"
							name="userId"
							required
							class="h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{#each data.addable as person (person.id)}
								<option value={person.id}>{person.name} ({person.email})</option>
							{/each}
						</select>
						<Button type="submit" disabled={adding}>Add</Button>
					</div>
				{/if}
				{#if form?.action === "members" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</form>
		{/if}
	</Card.Content>
</Card.Root>

<AlertDialog.Root open={removing !== null} onOpenChange={(open) => !open && (removing = null)}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove {removing?.name} from {data.settings.name}?</AlertDialog.Title>
			<AlertDialog.Description>
				They can no longer open this team, unless they are an owner or an admin of the
				organization. They stay in the organization.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				onclick={() => {
					if (removing) removeMember(removing);
					removing = null;
				}}
			>
				Remove
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Deleting is offered to those who can do it. -->
{#if data.canManage}
	<Card.Root class="max-w-2xl">
		<Card.Header>
			<Card.Title>Delete team</Card.Title>
			<Card.Description>
				Deletes the team with its projects and their files. This cannot be undone.
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
					Its projects and their files are deleted with it. This cannot be undone.
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
{/if}
