<script lang="ts">
	import CassetteTapeIcon from "@lucide/svelte/icons/cassette-tape";
	import ResetPasswordForm from "#lib/components/reset-password-form.svelte";
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
		<ResetPasswordForm />
	</div>
</div>
