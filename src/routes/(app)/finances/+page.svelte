<script lang="ts">
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import { enhance } from "$app/forms";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Dialog from "#lib/components/ui/dialog/index.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
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
	<Button onclick={() => (open = true)}>
		<PlusIcon data-icon="inline-start" />
		Add transaction
	</Button>
</div>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add a transaction</Dialog.Title>
			<Dialog.Description>Money going out or coming in.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/add"
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
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="status" value={status} />
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
				{#if form?.action === "add" && form.error}
					<Field.Error>{form.error}</Field.Error>
				{/if}
			</Field.Group>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit">Add transaction</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

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
			<Button variant="outline" onclick={() => (open = true)}>Add transaction</Button>
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
					<Table.Cell class="font-medium">{transaction.counterparty}</Table.Cell>
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
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
