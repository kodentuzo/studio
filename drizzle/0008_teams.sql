CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug"),
	CONSTRAINT "teams_slug_shape" CHECK ("teams"."slug" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length("teams"."slug") <= 40),
	CONSTRAINT "teams_name_length" CHECK (char_length("teams"."name") between 1 and 45)
);
