<script lang="ts">
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Empty from "#lib/components/ui/empty/index.js";
	import * as Table from "#lib/components/ui/table/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	function money(amount: string, currency: string) {
		return new Intl.NumberFormat("en", {
			style: "currency",
			currency,
			signDisplay: "exceptZero",
		}).format(Number(amount));
	}

	const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
</script>

<h1 class="text-2xl font-semibold">Transactions</h1>

<div class="grid gap-4 md:grid-cols-3">
	<Card.Root>
		<Card.Header>
			<Card.Description>Balance</Card.Description>
			<Card.Title class="text-2xl tabular-nums">{money(data.totals.balance, "EUR")}</Card.Title>
		</Card.Header>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Description>Income</Card.Description>
			<Card.Title class="text-2xl tabular-nums">{money(data.totals.income, "EUR")}</Card.Title>
		</Card.Header>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Description>Expenses</Card.Description>
			<Card.Title class="text-2xl tabular-nums">{money(data.totals.expenses, "EUR")}</Card.Title>
		</Card.Header>
	</Card.Root>
</div>

{#if data.transactions.length === 0}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon">
				<ReceiptIcon />
			</Empty.Media>
			<Empty.Title>No transactions yet</Empty.Title>
		</Empty.Header>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Date</Table.Head>
				<Table.Head>Who</Table.Head>
				<Table.Head>Note</Table.Head>
				<Table.Head class="text-end">Amount</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each data.transactions as transaction (transaction.id)}
				<Table.Row>
					<Table.Cell>{dateFormat.format(new Date(transaction.date))}</Table.Cell>
					<Table.Cell class="font-medium">{transaction.counterparty}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{transaction.note ?? ""}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">
						{money(transaction.amount, transaction.currency)}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}
