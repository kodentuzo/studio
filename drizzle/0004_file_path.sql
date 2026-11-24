ALTER TABLE "transactions" ADD COLUMN "file_path" text;--> statement-breakpoint
-- Carry each attachment over: the file's place on disk becomes the transaction's path.
UPDATE "transactions" SET "file_path" = "files"."key" FROM "files" WHERE "files"."id" = "transactions"."file_id";
