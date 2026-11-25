<script lang="ts">
	import FileIcon from "@lucide/svelte/icons/file";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import { enhance } from "$app/forms";
	import { vaultUrl } from "#lib/vault.js";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import * as Breadcrumb from "#lib/components/ui/breadcrumb/index.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let picker = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);

	// The file waiting for a yes or no on deleting it.
	let deleting = $state<(typeof data.files)[number] | null>(null);

	// The folders leading to this one, for the trail at the top: 2026, then 2026/11.
	const trail = $derived(
		data.dir
			.split("/")
			.filter(Boolean)
			.map((name, index, parts) => ({ name, path: parts.slice(0, index + 1).join("/") }))
	);

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

	function size(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function folderUrl(path: string) {
		return path ? `/vault?dir=${encodeURIComponent(path)}` : "/vault";
	}
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Vault</h1>
	<form
		method="POST"
		action="?/upload"
		enctype="multipart/form-data"
		use:enhance={() => {
			uploading = true;
			return async ({ update }) => {
				await update();
				uploading = false;
			};
		}}
	>
		<input type="hidden" name="dir" value={data.dir} />
		<input
			bind:this={picker}
			type="file"
			name="file"
			accept="application/pdf,image/png,image/jpeg,image/webp"
			class="sr-only"
			tabindex="-1"
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		/>
		<Button type="button" disabled={uploading} onclick={() => picker?.click()}>
			<UploadIcon data-icon="inline-start" />
			{uploading ? "Uploading…" : "Upload here"}
		</Button>
	</form>
</div>

<Breadcrumb.Root>
	<Breadcrumb.List>
		<Breadcrumb.Item>
			{#if trail.length === 0}
				<Breadcrumb.Page>Vault</Breadcrumb.Page>
			{:else}
				<Breadcrumb.Link href="/vault">Vault</Breadcrumb.Link>
			{/if}
		</Breadcrumb.Item>
		{#each trail as part, index (part.path)}
			<Breadcrumb.Separator />
			<Breadcrumb.Item>
				{#if index === trail.length - 1}
					<Breadcrumb.Page>{part.name}</Breadcrumb.Page>
				{:else}
					<Breadcrumb.Link href={folderUrl(part.path)}>{part.name}</Breadcrumb.Link>
				{/if}
			</Breadcrumb.Item>
		{/each}
	</Breadcrumb.List>
</Breadcrumb.Root>

{#if form?.error}
	<p role="alert" class="text-sm text-destructive">{form.error}</p>
{/if}

<AlertDialog.Root
	open={deleting !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) deleting = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this file?</AlertDialog.Title>
			<AlertDialog.Description>
				{#if deleting}
					{deleting.name}, {size(deleting.size)}. This cannot be undone.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<form
			method="POST"
			action="?/remove"
			use:enhance={() =>
				async ({ update }) => {
					await update();
					deleting = null;
				}}
		>
			<input type="hidden" name="path" value={deleting?.path ?? ""} />
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>

{#if data.folders.length === 0 && data.files.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<FolderIcon />
			</Empty.Media>
			<Empty.Title>{data.dir ? "This folder is empty" : "No files yet"}</Empty.Title>
			<Empty.Description>
				Files that must not be lost, such as invoices and receipts, are kept here.
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Changed</Table.Head>
				<Table.Head class="text-end">Size</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.folders as folder (folder.path)}
				<Table.Row>
					<Table.Cell class="font-medium" colspan={4}>
						<a href={folderUrl(folder.path)} class="flex items-center gap-2 hover:underline">
							<FolderIcon class="size-4 text-muted-foreground" />
							{folder.name}
						</a>
					</Table.Cell>
				</Table.Row>
			{/each}
			{#each data.files as file (file.path)}
				<Table.Row>
					<Table.Cell class="font-medium">
						<a
							href={vaultUrl(file.path)}
							target="_blank"
							rel="noopener"
							class="flex items-center gap-2 hover:underline"
						>
							<FileIcon class="size-4 text-muted-foreground" />
							{file.name}
						</a>
					</Table.Cell>
					<Table.Cell>{dateFormat.format(file.modified)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{size(file.size)}</Table.Cell>
					<Table.Cell class="text-end">
						<Button variant="ghost" size="icon" onclick={() => (deleting = file)}>
							<TrashIcon />
							<span class="sr-only">Delete</span>
						</Button>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
