<script lang="ts">
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import * as Avatar from "#lib/components/ui/avatar/index.js";
	import * as Sidebar from "#lib/components/ui/sidebar/index.js";

	import { goto } from "$app/navigation";
	import { authClient } from "#lib/auth-client.js";

	// The foot of the sidebar: who is signed in, leading to their own pages on the account
	// service, and signing out. When the sidebar is collapsed only signing out is left.
	let {
		user,
		authUrl,
	}: {
		user: { name: string; email: string; image?: string | null };
		// Where the account service is reached.
		authUrl: string;
	} = $props();

	// Up to two initials, shown when the user has no picture.
	const initials = $derived(
		user.name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("")
	);

	async function signOut() {
		await authClient.signOut();
		await goto("/auth/sign-in", { invalidateAll: true });
	}
</script>

<Sidebar.Menu>
	<Sidebar.MenuItem class="flex items-center gap-1">
		<Sidebar.MenuButton size="lg" class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden!">
			{#snippet child({ props })}
				<a href={authUrl} {...props}>
					<Avatar.Root class="size-8 rounded-lg">
						{#if user.image}
							<Avatar.Image src={user.image} alt={user.name} />
						{/if}
						<Avatar.Fallback class="rounded-lg">{initials}</Avatar.Fallback>
					</Avatar.Root>
					<div class="grid flex-1 text-start text-sm leading-tight">
						<span class="truncate font-medium">{user.name}</span>
						<span class="truncate text-xs">{user.email}</span>
					</div>
				</a>
			{/snippet}
		</Sidebar.MenuButton>
		<Sidebar.MenuButton
			tooltipContent="Sign out"
			class="size-8 flex-none justify-center p-2"
			aria-label="Sign out"
			onclick={signOut}
		>
			<LogOutIcon />
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
</Sidebar.Menu>
