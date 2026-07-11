import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "miniflux_mappings" ADD COLUMN "enabled" boolean DEFAULT true;
  ALTER TABLE "miniflux_mappings" ADD COLUMN "last_synced" timestamp(3) with time zone;
  UPDATE "miniflux_mappings" SET "enabled" = COALESCE("active", true), "last_synced" = "last_sync_at";
  ALTER TABLE "articles" ADD COLUMN "trending_multiplier" numeric DEFAULT 1;
  ALTER TABLE "_articles_v" ADD COLUMN "version_trending_multiplier" numeric DEFAULT 1;
  CREATE INDEX "miniflux_mappings_enabled_idx" ON "miniflux_mappings" USING btree ("enabled");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "miniflux_mappings_enabled_idx";
  ALTER TABLE "_articles_v" DROP COLUMN "version_trending_multiplier";
  ALTER TABLE "articles" DROP COLUMN "trending_multiplier";
  ALTER TABLE "miniflux_mappings" DROP COLUMN "last_synced";
  ALTER TABLE "miniflux_mappings" DROP COLUMN "enabled";`)
}
