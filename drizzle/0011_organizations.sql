ALTER TABLE "teams" RENAME TO "organizations";--> statement-breakpoint
ALTER TABLE "organizations" RENAME CONSTRAINT "teams_pkey" TO "organizations_pkey";--> statement-breakpoint
ALTER TABLE "organizations" RENAME CONSTRAINT "teams_slug_unique" TO "organizations_slug_unique";--> statement-breakpoint
ALTER TABLE "organizations" RENAME CONSTRAINT "teams_slug_shape" TO "organizations_slug_shape";--> statement-breakpoint
ALTER TABLE "organizations" RENAME CONSTRAINT "teams_name_length" TO "organizations_name_length";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "team_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "projects_team_id_teams_id_fk" TO "projects_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "projects" RENAME CONSTRAINT "projects_team_slug_unique" TO "projects_organization_slug_unique";--> statement-breakpoint
ALTER TABLE "transactions" RENAME COLUMN "team_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "transactions" RENAME CONSTRAINT "transactions_team_id_teams_id_fk" TO "transactions_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "transaction_documents" RENAME COLUMN "team_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "transaction_documents" RENAME CONSTRAINT "transaction_documents_team_id_teams_id_fk" TO "transaction_documents_organization_id_organizations_id_fk";
--> statement-breakpoint
-- Newer Postgres also names each "not null" rule after its table and column.
DO $$
DECLARE rule record;
BEGIN
	FOR rule IN
		SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
		WHERE contype = 'n' AND (conname LIKE 'teams\_%' OR conname LIKE '%\_team\_id\_%')
	LOOP
		EXECUTE format(
			'ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
			rule.tbl,
			rule.conname,
			replace(replace(rule.conname, 'teams_', 'organizations_'), '_team_id_', '_organization_id_')
		);
	END LOOP;
END $$;
