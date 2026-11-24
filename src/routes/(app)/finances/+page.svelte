<script lang="ts">
	import PaperclipIcon from "@lucide/svelte/icons/paperclip";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import XIcon from "@lucide/svelte/icons/x";
	import { deserialize, enhance } from "$app/forms";
	import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Dialog from "#lib/components/ui/dialog/index.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import * as Sheet from "#lib/components/ui/sheet/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import * as Tabs from "#lib/components/ui/tabs/index.js";
	import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
	import { Badge } from "#lib/components/ui/badge/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	const today = new Date().toISOString().slice(0, 10);

	let open = $state(false);
	let kind = $state("expense");
	let status = $state("paid");
	let date = $state(today);
	let amount = $state("");
	let counterparty = $state("");
	let note = $state("");

	// Which tab of the add sheet is showing: "upload" or "manual".
	let tab = $state("upload");

	// The file attached to the transaction in the form, if any.
	let attachment = $state<{ id: string; name: string } | null>(null);
	let attaching = $state(false);
	let attachError = $state("");

	// Uploading and reading an invoice on the upload tab.
	let reading = $state(false);
	let readError = $state("");
	let readNote = $state("");

	// Calls one of the page actions and gives back what it returned.
	async function callAction(url: string, body: FormData) {
		const response = await fetch(url, {
			method: "POST",
			body,
			headers: { "x-sveltekit-action": "true", accept: "application/json" },
		});
		return deserialize(await response.text());
	}

	// Stores a file through the Files page's upload action.
	async function storeFile(
		file: File
	): Promise<{ file: { id: string; name: string; contentType: string } } | { error: string }> {
		const body = new FormData();
		body.set("file", file);
		const result = await callAction("/files?/upload", body);

		if (result.type === "success" && result.data?.file) {
			return {
				file: result.data.file as { id: string; name: string; contentType: string },
			};
		}
		return {
			error:
				result.type === "failure"
					? String(result.data?.error ?? "The file could not be stored.")
					: "The file could not be stored.",
		};
	}

	// The upload tab: store the file, attach it, read it if it can be read, then show the form.
	async function uploadInvoice(file: File) {
		reading = true;
		readError = "";
		readNote = "";

		const stored = await storeFile(file);
		if ("error" in stored) {
			readError = stored.error;
			reading = false;
			return;
		}

		attachment = { id: stored.file.id, name: stored.file.name };
		kind = "expense";

		if (data.canReadInvoices && stored.file.contentType === "application/pdf") {
			const body = new FormData();
			body.set("fileId", stored.file.id);
			const result = await callAction("?/readInvoice", body);

			if (result.type === "success" && result.data?.invoice) {
				const invoice = result.data.invoice as {
					date: string;
					amount: string;
					currency: string;
					counterparty: string;
				};
				date = invoice.date;
				amount = invoice.amount;
				counterparty = invoice.counterparty;
				readNote =
					invoice.currency === "EUR"
						? "Filled in from the invoice. Check the values before saving."
						: `Filled in from the invoice, which is in ${invoice.currency}. Studio records euros, so change the amount.`;
			} else {
				const reason =
					result.type === "failure" ? String(result.data?.error ?? "") : "";
				readNote = `The file is attached. ${reason || "It could not be read, so fill in the details by hand."}`;
			}
		} else {
			readNote = "The file is attached. Fill in the details by hand.";
		}

		reading = false;
		tab = "manual";
	}

	// The attachment field on the form: store the file and attach it.
	async function attachFile(file: File) {
		attaching = true;
		attachError = "";

		const stored = await storeFile(file);
		if ("error" in stored) {
			attachError = stored.error;
		} else {
			attachment = { id: stored.file.id, name: stored.file.name };
		}

		attaching = false;
	}

	// The id of the row being edited, or null when adding a new one.
	let editingId = $state<string | null>(null);

	function startAdd() {
		if (editingId) {
			// The fields still hold the row that was last edited. Start clean.
			kind = "expense";
			date = today;
		}
		editingId = null;
		amount = "";
		counterparty = "";
		note = "";
		status = "paid";
		readError = "";
		readNote = "";
		attachment = null;
		attachError = "";
		tab = "upload";
		open = true;
	}

	function startEdit(transaction: (typeof data.transactions)[number]) {
		editingId = transaction.id;
		kind = Number(transaction.amount) < 0 ? "expense" : "income";
		// Shown without the sign, and without trailing zeros: 7.49, 50.
		amount = String(Math.abs(Number(transaction.amount)));
		date = transaction.date;
		counterparty = transaction.counterparty;
		note = transaction.note ?? "";
		status = transaction.status;
		attachment =
			transaction.fileId && transaction.fileName
				? { id: transaction.fileId, name: transaction.fileName }
				: null;
		attachError = "";
		open = true;
	}

	// The row waiting for a yes or no on deleting it.
	let deleting = $state<(typeof data.transactions)[number] | null>(null);

	let openingOpen = $state(false);
	let openingAmount = $state("");

	function editOpening() {
		// Start from what is saved, or from nothing.
		openingAmount = data.opening ? String(Number(data.opening.amount)) : "";
		openingOpen = true;
	}

	// "exceptZero" shows + and -, "negative" shows only -, "never" shows neither.
	function money(
		amount: string,
		currency: string,
		signDisplay: "exceptZero" | "negative" | "never" = "exceptZero"
	) {
		return new Intl.NumberFormat("en", { style: "currency", currency, signDisplay }).format(
			Number(amount)
		);
	}

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
</script>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">Finances</h1>
	<Button onclick={startAdd}>
		<PlusIcon data-icon="inline-start" />
		Add transaction
	</Button>
</div>

{#snippet uploadForm()}
	<Field.Field>
		<Field.Label for="invoice">Invoice or receipt</Field.Label>
		<Input
			id="invoice"
			type="file"
			accept="application/pdf,image/png,image/jpeg,image/webp"
			disabled={reading}
			onchange={(event) => {
				const file = event.currentTarget.files?.[0];
				if (file) uploadInvoice(file);
			}}
		/>
		{#if reading}
			<Field.Description>
				{data.canReadInvoices ? "Storing and reading the file…" : "Storing the file…"}
			</Field.Description>
		{:else if readError}
			<Field.Error>{readError}</Field.Error>
		{:else if data.canReadInvoices}
			<Field.Description>
				The file is attached to the transaction. From a PDF with text in it, Studio also reads
				the date, the total and the seller, then shows you the form to check.
			</Field.Description>
		{:else}
			<Field.Description>
				The file is attached to the transaction. Then you fill in the details.
			</Field.Description>
		{/if}
	</Field.Field>
{/snippet}

{#snippet entryForm()}
	<form
		method="POST"
		action={editingId ? "?/edit" : "?/add"}
		class="flex flex-col gap-6"
		use:enhance={() =>
			async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === "success") {
					// Keep the kind and the date for the next one; clear the rest.
					amount = "";
					counterparty = "";
					note = "";
					status = "paid";
					open = false;
				}
			}}
	>
		{#if readNote && !editingId}
			<Field.Description>{readNote}</Field.Description>
		{/if}
		{#if editingId}
			<input type="hidden" name="id" value={editingId} />
		{/if}
		<input type="hidden" name="kind" value={kind} />
		<input type="hidden" name="status" value={status} />
		<input type="hidden" name="fileId" value={attachment?.id ?? ""} />
		<Field.Group>
			<Field.Field>
				<Field.Label>Kind</Field.Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					value={kind}
					onValueChange={(value) => {
						// Clicking the chosen one again would clear it. Keep a choice.
						if (value) kind = value;
					}}
				>
					<ToggleGroup.Item value="expense">Expense</ToggleGroup.Item>
					<ToggleGroup.Item value="income">Income</ToggleGroup.Item>
				</ToggleGroup.Root>
			</Field.Field>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="date">Date</Field.Label>
					<Input id="date" name="date" type="date" required bind:value={date} />
				</Field.Field>
				<Field.Field>
					<Field.Label for="amount">Amount in euros</Field.Label>
					<Input
						id="amount"
						name="amount"
						type="text"
						inputmode="decimal"
						placeholder="7.49"
						required
						bind:value={amount}
					/>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label for="counterparty">
					{kind === "expense" ? "Paid to" : "Received from"}
				</Field.Label>
				<Input
					id="counterparty"
					name="counterparty"
					type="text"
					placeholder="Hetzner"
					required
					bind:value={counterparty}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="note">Note</Field.Label>
				<Input id="note" name="note" type="text" bind:value={note} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="attachment">Attachment</Field.Label>
				{#if attachment}
					<div class="flex items-center gap-2">
						<PaperclipIcon class="size-4 shrink-0 text-muted-foreground" />
						<a
							href="/files/{attachment.id}"
							target="_blank"
							rel="noopener"
							class="truncate text-sm hover:underline"
						>
							{attachment.name}
						</a>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							class="ms-auto"
							onclick={() => (attachment = null)}
						>
							<XIcon />
							<span class="sr-only">Remove attachment</span>
						</Button>
					</div>
				{:else}
					<Input
						id="attachment"
						type="file"
						accept="application/pdf,image/png,image/jpeg,image/webp"
						disabled={attaching}
						onchange={(event) => {
							const file = event.currentTarget.files?.[0];
							if (file) attachFile(file);
						}}
					/>
					{#if attaching}
						<Field.Description>Storing the file…</Field.Description>
					{:else if attachError}
						<Field.Error>{attachError}</Field.Error>
					{/if}
				{/if}
			</Field.Field>
			<Field.Field>
				<Field.Label>Status</Field.Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					value={status}
					onValueChange={(value) => {
						if (value) status = value;
					}}
				>
					<ToggleGroup.Item value="paid">Paid</ToggleGroup.Item>
					<ToggleGroup.Item value="planned">Planned</ToggleGroup.Item>
				</ToggleGroup.Root>
				<Field.Description>
					A planned transaction is listed but not counted until it is paid.
				</Field.Description>
			</Field.Field>
			{#if (form?.action === "add" || form?.action === "edit") && form.error}
				<Field.Error>{form.error}</Field.Error>
			{/if}
		</Field.Group>
		<div class="flex justify-end gap-2">
			<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit">{editingId ? "Save changes" : "Add transaction"}</Button>
		</div>
	</form>
{/snippet}

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-md">
		<Sheet.Header>
			<Sheet.Title>{editingId ? "Edit transaction" : "Add a transaction"}</Sheet.Title>
			<Sheet.Description>Money going out or coming in.</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-6 px-4 pb-4">
			{#if !editingId}
				<Tabs.Root bind:value={tab} class="gap-6">
					<Tabs.List class="w-full">
						<Tabs.Trigger value="upload">Upload file</Tabs.Trigger>
						<Tabs.Trigger value="manual">Enter manually</Tabs.Trigger>
					</Tabs.List>
					<Tabs.Content value="upload">
						{@render uploadForm()}
					</Tabs.Content>
					<Tabs.Content value="manual">
						{@render entryForm()}
					</Tabs.Content>
				</Tabs.Root>
			{:else}
				{@render entryForm()}
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

<div class="grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Description>Balance</Card.Description>
			<Card.Title class="text-2xl tabular-nums">
				{money(data.totals.balance, "EUR", "negative")}
			</Card.Title>
			<Card.Action>
				<Button variant="ghost" size="icon" onclick={editOpening}>
					<PencilIcon />
					<span class="sr-only">Edit opening balance</span>
				</Button>
			</Card.Action>
		</Card.Header>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Description>Income</Card.Description>
			<Card.Title class="text-2xl tabular-nums">{money(data.totals.income, "EUR", "never")}</Card.Title>
		</Card.Header>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Description>Expenses</Card.Description>
			<Card.Title class="text-2xl tabular-nums">{money(data.totals.expenses, "EUR", "never")}</Card.Title>
		</Card.Header>
	</Card.Root>
</div>

<Dialog.Root bind:open={openingOpen}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Opening balance</Dialog.Title>
			<Dialog.Description>
				What you had before the first transaction here. Set it to 0 to remove it.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/opening"
			class="flex flex-col gap-6"
			use:enhance={() =>
				async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === "success") openingOpen = false;
				}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="opening-amount">Amount in euros</Field.Label>
					<Input
						id="opening-amount"
						name="amount"
						type="text"
						inputmode="decimal"
						placeholder="100"
						required
						bind:value={openingAmount}
					/>
				</Field.Field>
				{#if form?.action === "opening" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (openingOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	open={deleting !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) deleting = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this transaction?</AlertDialog.Title>
			<AlertDialog.Description>
				{#if deleting}
					{deleting.counterparty}, {money(deleting.amount, deleting.currency)}, on
					{dateFormat.format(new Date(deleting.date))}. This cannot be undone.
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

<h2 class="text-lg font-semibold">Transactions</h2>

{#if data.transactions.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<ReceiptIcon />
			</Empty.Media>
			<Empty.Title>No transactions yet</Empty.Title>
			<Empty.Description>Add the first one to start tracking.</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button variant="outline" onclick={startAdd}>Add transaction</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Date</Table.Head>
				<Table.Head>Who</Table.Head>
				<Table.Head>Note</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head class="text-end">Amount</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.transactions as transaction (transaction.id)}
				<Table.Row>
					<Table.Cell>
						{#if transaction.source !== "opening"}
							{dateFormat.format(new Date(transaction.date))}
						{/if}
					</Table.Cell>
					<Table.Cell class="font-medium">
						<span class="flex items-center gap-2">
							{transaction.counterparty}
							{#if transaction.fileId}
								<a
									href="/files/{transaction.fileId}"
									target="_blank"
									rel="noopener"
									class="text-muted-foreground hover:text-foreground"
								>
									<PaperclipIcon class="size-4" />
									<span class="sr-only">Open {transaction.fileName ?? "attachment"}</span>
								</a>
							{/if}
						</span>
					</Table.Cell>
					<Table.Cell class="text-muted-foreground">{transaction.note ?? ""}</Table.Cell>
					<Table.Cell>
						{#if transaction.status === "planned"}
							<form method="POST" action="?/markPaid" use:enhance class="flex items-center gap-2">
								<input type="hidden" name="id" value={transaction.id} />
								<Badge variant="outline">Planned</Badge>
								<Button type="submit" variant="ghost" size="sm">Mark paid</Button>
							</form>
						{:else if transaction.source !== "opening"}
							<Badge variant="secondary">Paid</Badge>
						{/if}
					</Table.Cell>
					<Table.Cell class="text-end tabular-nums">
						{money(
							transaction.amount,
							transaction.currency,
							transaction.source === "opening" ? "negative" : "exceptZero"
						)}
					</Table.Cell>
					<Table.Cell class="text-end">
						<!-- The opening balance is edited from the Balance card. -->
						<Button
							variant="ghost"
							size="icon"
							onclick={() =>
								transaction.source === "opening" ? editOpening() : startEdit(transaction)}
						>
							<PencilIcon />
							<span class="sr-only">Edit</span>
						</Button>
						{#if transaction.source !== "opening"}
							<Button variant="ghost" size="icon" onclick={() => (deleting = transaction)}>
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
