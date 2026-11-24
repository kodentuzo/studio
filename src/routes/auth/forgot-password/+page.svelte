<script lang="ts">
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import * as Card from "#lib/components/ui/card/index.js";
	import { Button } from "#lib/components/ui/button/index.js";
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CassetteTapeIcon class="size-4" />
			</div>
			Studio
		</a>
		<Card.Root>
			<Card.Header class="gap-2 text-center">
				<Card.Title class="text-xl">Forgot your password?</Card.Title>
				<Card.Description>Ask your admin to reset it.</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button href="/auth/sign-in" variant="outline" class="w-full">Back to sign in</Button>
			</Card.Footer>
		</Card.Root>
	</div>
</div>
