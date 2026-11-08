CREATE TABLE "tenant_trial_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"days_remaining" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_trial_reminders_tenant_id_days_remaining_unique" UNIQUE("tenant_id","days_remaining")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "premium_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_trial_reminders" ADD CONSTRAINT "tenant_trial_reminders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;