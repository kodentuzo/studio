<script lang="ts">
	import { BarChart } from "layerchart";
	import * as Card from "#lib/components/ui/card/index.js";
	import * as Chart from "#lib/components/ui/chart/index.js";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	const chartConfig = {
		income: { label: "Income", theme: { light: "#2a78d6", dark: "#3987e5" } },
		expenses: { label: "Expenses", theme: { light: "#e34948", dark: "#e66767" } },
	} satisfies Chart.ChartConfig;

	const isEmpty = $derived(data.months.every((m) => m.income === 0 && m.expenses === 0));

	// Whole euros on the axis, cents in the tooltip.
	const euros = new Intl.NumberFormat("en", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	});
	const eurosExact = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
</script>

<h1 class="text-2xl font-semibold">Overview</h1>

<Card.Root>
	<Card.Header>
		<Card.Title>Income and expenses</Card.Title>
		<Card.Description>Per month, {data.year}</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="relative">
			<Chart.Container config={chartConfig} class="aspect-auto h-72 w-full">
				<BarChart
					data={data.months}
					x="month"
					series={[
						{ key: "income", label: "Income", color: "var(--color-income)" },
						{ key: "expenses", label: "Expenses", color: "var(--color-expenses)" },
					]}
					seriesLayout="stackDiverging"
					yDomain={isEmpty ? [-100, 100] : undefined}
					legend
					props={{
						bars: { radius: 4, strokeWidth: 0 },
						yAxis: { format: (value: number) => euros.format(value) },
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip>
							{#snippet formatter({ value, name, item })}
								<div
									class="size-2.5 shrink-0 rounded-[2px]"
									style="background: {chartConfig[item.key as keyof typeof chartConfig]?.theme
										.light}"
								></div>
								<div class="flex flex-1 items-center justify-between gap-6 leading-none">
									<span class="text-muted-foreground">{name}</span>
									<!-- Expenses are stored negative; the label already says which way. -->
									<span class="font-medium text-foreground tabular-nums">
										{eurosExact.format(Math.abs(Number(value)))}
									</span>
								</div>
							{/snippet}
						</Chart.Tooltip>
					{/snippet}
				</BarChart>
			</Chart.Container>
			{#if isEmpty}
				<p
					class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
				>
					No transactions yet
				</p>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
