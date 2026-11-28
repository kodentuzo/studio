<script lang="ts">
	import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
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

	// Invitations: nothing is sent, so each one has a link to copy and pass on.
	let inviting = $state(false);
	let copied = $state<string | null>(null);

	async function copyLink(id: string) {
		await navigator.clipboard.writeText(`${page.url.origin}/invitations/${id}`);
		copied = id;
		setTimeout(() => {
			if (copied === id) copied = null;
		}, 2000);
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

		{#if data.canManageMembers}
			{#if data.invitations.length > 0}
				<div class="flex flex-col gap-2">
					<h3 class="text-sm font-medium">Invitations</h3>
					<p class="text-sm text-muted-foreground">
						Studio sends no email. Copy an invitation's link and pass it on; only the account
						with that email address can use it.
					</p>
					<Table.Root>
						<Table.Body>
							{#each data.invitations as invitation (invitation.id)}
								<Table.Row>
									<Table.Cell>
										<div class="font-medium">{invitation.email}</div>
										<div class="text-sm text-muted-foreground">
											{roleNames(invitation.role)} · expires {dateFormat.format(invitation.expires)}
										</div>
									</Table.Cell>
									<Table.Cell class="text-end">
										<Button variant="outline" size="sm" onclick={() => copyLink(invitation.id)}>
											{copied === invitation.id ? "Copied" : "Copy link"}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											disabled={membersBusy}
											onclick={() =>
												memberAction("cancelInvitation", { invitationId: invitation.id })}
										>
											Cancel
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}

			<form
				method="POST"
				action="?/invite"
				class="flex flex-col gap-2"
				use:enhance={() => {
					inviting = true;
					return async ({ update }) => {
						await update();
						inviting = false;
					};
				}}
			>
				<Field.Label for="invite-email">Invite someone</Field.Label>
				<div class="flex flex-wrap gap-2">
					<Input
						id="invite-email"
						name="email"
						type="email"
						autocomplete="off"
						placeholder="name@example.com"
						required
						class="min-w-48 flex-1"
						value={form?.action === "invite" && form.error ? form.email : ""}
					/>
					<select
						name="role"
						aria-label="Role"
						class="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						{#each ROLES.toReversed() as role (role.value)}
							<option value={role.value}>{role.label}</option>
						{/each}
					</select>
					<Button type="submit" disabled={inviting}>Invite</Button>
				</div>
				{#if form?.action === "invite" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</form>
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
