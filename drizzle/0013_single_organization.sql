DROP INDEX "transactions_one_opening";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_organization_slug_unique";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "transaction_documents" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_unique" UNIQUE("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_one_opening" ON "transactions" USING btree ("source") WHERE "transactions"."source" = 'opening';--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_only_one" ON "organizations" USING btree ((true));
