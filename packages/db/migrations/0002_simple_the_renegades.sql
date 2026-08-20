ALTER TABLE "magic_link_tokens" DROP CONSTRAINT "magic_link_tokens_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "magic_link_tokens" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "password_reset_tokens" DROP COLUMN "tenant_id";