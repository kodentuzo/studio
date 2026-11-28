ALTER TABLE "teams" ADD COLUMN "personal_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_personal_user_id_unique" UNIQUE("personal_user_id");