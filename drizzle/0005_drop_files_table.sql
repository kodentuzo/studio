ALTER TABLE "transactions" DROP CONSTRAINT "transactions_file_id_files_id_fk";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "file_id";--> statement-breakpoint
DROP TABLE "files";
