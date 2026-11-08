ALTER TABLE "tenants" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Existing tenants predate the onboarding wizard and already have real
-- members/contributions recorded the old way — treated as already
-- onboarded so they aren't redirected into a setup flow for a cooperative
-- that's already up and running.
UPDATE "tenants" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
-- Every existing user already has a real password they chose themselves —
-- there was no placeholder-member flow before this column existed.
UPDATE "users" SET "claimed_at" = "created_at" WHERE "claimed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "member_since" date;--> statement-breakpoint
-- Existing memberships have no separate "real join date" on file — their
-- own creation date is the only fact available, so it backfills this
-- column exactly as it already anchored obligation periods before this
-- change.
UPDATE "memberships" SET "member_since" = "created_at"::date WHERE "member_since" IS NULL;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "member_since" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "membership_invites" ADD COLUMN "claim_user_id" uuid;--> statement-breakpoint
ALTER TABLE "membership_invites" ADD CONSTRAINT "membership_invites_claim_user_id_users_id_fk" FOREIGN KEY ("claim_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
