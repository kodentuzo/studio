DROP INDEX "transactions_one_opening";--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "transaction_documents" ADD CONSTRAINT "transaction_documents_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_one_personal_opening" ON "transactions" USING btree ("team_id") WHERE "transactions"."source" = 'opening' and "transactions"."team_id" is not null;--> statement-breakpoint
CREATE INDEX "transactions_team" ON "transactions" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_one_opening" ON "transactions" USING btree ("source") WHERE "transactions"."source" = 'opening' and "transactions"."team_id" is null;