ALTER TABLE "users" ADD COLUMN "name" varchar(255);--> statement-breakpoint
-- Existing accounts predate this column and have no real name on file —
-- backfilled from their email's local part as a placeholder rather than
-- left null, so the column can become NOT NULL like every account from
-- here on. Each account owner can correct it from /account.
UPDATE "users" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;