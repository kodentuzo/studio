<script lang="ts">
	import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
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

	// Deleting asks for the organization's slug, typed out.
	let deleteOpen = $state(false);
	let typedSlug = $state("");
	let deleting = $state(false);

	// Members: what each role is called, and the one being removed while that is confirmed.
	const ROLES = [
		{ value: "owner", label: "Owner" },
		{ value: "admin", label: "Admin" },
		{ value: "member", label: "Member" },
	];
	type Member = (typeof data.members)[number];
	let removing = $state<Member | null>(null);
	let membersBusy = $state(false);
	let membersError = $state("");

	// A member can hold several roles, kept as one text with commas between them.
	function roleNames(role: string) {
		return role
			.split(",")
			.map((value) => ROLES.find((known) => known.value === value)?.label ?? value)
			.join(", ");
	}

	// Runs one of the member actions, then reads the list again whatever the answer was.
	async function memberAction(action: string, fields: Record<string, string>) {
		membersBusy = true;
		membersError = "";
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.set(key, value);

		const result = await callAction(`?/${action}`, body);
		if (result.type === "failure") {
			membersError = String(result.data?.error ?? "That could not be done.");
		} else if (result.type === "error") {
			membersError = result.error?.message ?? "That could not be done.";
		}
		await invalidateAll();
		membersBusy = false;
	}
</script>

<h1 class="text-2xl font-semibold">Settings</h1>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>General</Card.Title>
		<Card.Description>How the organization is named and where it lives.</Card.Description>
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
						The organization's address is /organizations/{data.settings.slug}. It cannot be changed.
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
					Only an owner of the organization can change these.
				</p>
			{/if}
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="max-w-2xl">
	<Card.Header>
		<Card.Title>Members</Card.Title>
		<Card.Description>The people who belong to the organization, and what each may do.</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Role</Table.Head>
					<Table.Head>Joined</Table.Head>
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
						<Table.Cell>{roleNames(member.role)}</Table.Cell>
						<Table.Cell class="text-muted-foreground">
							{dateFormat.format(member.joined)}
						</Table.Cell>
						<Table.Cell class="text-end">
							<!-- Nobody changes or removes themselves here. -->
							{#if data.canManageMembers && !member.isYou}
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button {...props} variant="ghost" size="icon" disabled={membersBusy}>
												<EllipsisIcon />
												<span class="sr-only">Actions for {member.name}</span>
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="min-w-56">
										<DropdownMenu.Label class="text-xs text-muted-foreground">Role</DropdownMenu.Label>
										<DropdownMenu.RadioGroup
											value={member.role}
											onValueChange={(role) => memberAction("memberRole", { memberId: member.id, role })}
										>
											{#each ROLES as role (role.value)}
												<DropdownMenu.RadioItem value={role.value}>{role.label}</DropdownMenu.RadioItem>
											{/each}
										</DropdownMenu.RadioGroup>
										<DropdownMenu.Separator />
										<DropdownMenu.Item variant="destructive" onSelect={() => (removing = member)}>
											Remove from organization
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		{#if membersError}
			<Field.Error>{membersError}</Field.Error>
		{/if}
	</Card.Content>
</Card.Root>

<AlertDialog.Root open={removing !== null} onOpenChange={(open) => !open && (removing = null)}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove {removing?.name}?</AlertDialog.Title>
			<AlertDialog.Description>
				They can no longer open {data.settings.name}. Their account stays, and so does everything
				they added.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				variant="destructive"
				onclick={() => {
					if (removing) memberAction("removeMember", { memberId: removing.id });
					removing = null;
				}}
			>
				Remove
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Deleting is offered to owners only. -->
{#if data.canManage}
	<Card.Root class="max-w-2xl">
		<Card.Header>
			<Card.Title>Delete organization</Card.Title>
			<Card.Description>
				Deletes the organization with its projects, transactions, documents and files. This cannot be undone.
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
				Delete organization
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
						Type the organization's slug, {data.settings.slug}, to confirm
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
						Delete organization
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
