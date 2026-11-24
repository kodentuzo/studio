<script lang="ts">
	import FileIcon from "@lucide/svelte/icons/file";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import { enhance } from "$app/forms";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	let picker = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);

	// The unused file waiting for a yes or no on deleting it.
	let deleting = $state<(typeof data.files)[number] | null>(null);

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
	const useDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

	function size(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Files</h1>
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
			{uploading ? "Uploading…" : "Upload file"}
		</Button>
	</form>
</div>

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
			<input type="hidden" name="id" value={deleting?.id ?? ""} />
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>

{#if data.files.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<FileIcon />
			</Empty.Media>
			<Empty.Title>No files yet</Empty.Title>
			<Empty.Description>
				Invoices and receipts attached to transactions are kept here.
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head>Uploaded</Table.Head>
				<Table.Head class="text-end">Size</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.files as file (file.id)}
				<Table.Row>
					<Table.Cell class="font-medium">
						<a href="/files/{file.id}" target="_blank" rel="noopener" class="hover:underline">
							{file.name}
						</a>
					</Table.Cell>
					<Table.Cell>
						{#if file.uses.length === 0}
							<Badge variant="outline">Unused</Badge>
						{:else}
							<div class="flex flex-col gap-1">
								{#each file.uses as use (use.id)}
									<a href="/finances" class="hover:underline">
										{use.counterparty}, {useDateFormat.format(new Date(use.date))}
									</a>
								{/each}
							</div>
						{/if}
					</Table.Cell>
					<Table.Cell>{dateFormat.format(file.createdAt)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{size(file.size)}</Table.Cell>
					<Table.Cell class="text-end">
						{#if file.uses.length === 0}
							<Button variant="ghost" size="icon" onclick={() => (deleting = file)}>
								<TrashIcon />
								<span class="sr-only">Delete</span>
							</Button>
						{/if}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
