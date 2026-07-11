import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_miniflux_mappings_source_type" AS ENUM('category', 'feed');
  CREATE TABLE "miniflux_mappings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"source_type" "enum_miniflux_mappings_source_type" DEFAULT 'category' NOT NULL,
  	"miniflux_target_id" varchar NOT NULL,
  	"miniflux_target_key" varchar,
  	"miniflux_target_title" varchar,
  	"section_id" integer NOT NULL,
  	"default_author_id" integer NOT NULL,
  	"fetch_limit" numeric DEFAULT 10 NOT NULL,
  	"active" boolean DEFAULT true,
  	"last_sync_at" timestamp(3) with time zone,
  	"last_sync_created" numeric DEFAULT 0,
  	"last_sync_updated" numeric DEFAULT 0,
  	"last_sync_skipped" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "meta_miniflux_id" varchar;
  ALTER TABLE "articles" ADD COLUMN "meta_miniflux_source_title" varchar;
  ALTER TABLE "articles" ADD COLUMN "meta_miniflux_imported_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_meta_miniflux_id" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_meta_miniflux_source_title" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_meta_miniflux_imported_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "miniflux_mappings_id" integer;
  ALTER TABLE "miniflux_mappings" ADD CONSTRAINT "miniflux_mappings_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "miniflux_mappings" ADD CONSTRAINT "miniflux_mappings_default_author_id_authors_id_fk" FOREIGN KEY ("default_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "miniflux_mappings_miniflux_target_key_idx" ON "miniflux_mappings" USING btree ("miniflux_target_key");
  CREATE INDEX "miniflux_mappings_section_idx" ON "miniflux_mappings" USING btree ("section_id");
  CREATE INDEX "miniflux_mappings_default_author_idx" ON "miniflux_mappings" USING btree ("default_author_id");
  CREATE INDEX "miniflux_mappings_updated_at_idx" ON "miniflux_mappings" USING btree ("updated_at");
  CREATE INDEX "miniflux_mappings_created_at_idx" ON "miniflux_mappings" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_miniflux_mappings_fk" FOREIGN KEY ("miniflux_mappings_id") REFERENCES "public"."miniflux_mappings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "articles_meta_meta_miniflux_id_idx" ON "articles" USING btree ("meta_miniflux_id");
  CREATE INDEX "_articles_v_version_meta_version_meta_miniflux_id_idx" ON "_articles_v" USING btree ("version_meta_miniflux_id");
  CREATE INDEX "payload_locked_documents_rels_miniflux_mappings_id_idx" ON "payload_locked_documents_rels" USING btree ("miniflux_mappings_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "miniflux_mappings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "miniflux_mappings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_miniflux_mappings_fk";
  
  DROP INDEX "articles_meta_meta_miniflux_id_idx";
  DROP INDEX "_articles_v_version_meta_version_meta_miniflux_id_idx";
  DROP INDEX "payload_locked_documents_rels_miniflux_mappings_id_idx";
  ALTER TABLE "articles" DROP COLUMN "meta_miniflux_id";
  ALTER TABLE "articles" DROP COLUMN "meta_miniflux_source_title";
  ALTER TABLE "articles" DROP COLUMN "meta_miniflux_imported_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_meta_miniflux_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_meta_miniflux_source_title";
  ALTER TABLE "_articles_v" DROP COLUMN "version_meta_miniflux_imported_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "miniflux_mappings_id";
  DROP TYPE "public"."enum_miniflux_mappings_source_type";`)
}
