CREATE TABLE "monthly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_digests_tenant_id_period_unique" UNIQUE("tenant_id","period")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "digest_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monthly_digests" ADD CONSTRAINT "monthly_digests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;