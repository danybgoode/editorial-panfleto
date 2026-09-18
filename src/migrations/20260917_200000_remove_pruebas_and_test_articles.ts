import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  // 1. Delete all old test articles from when testing in July 2026, or under 'pruebas' section
  // 2. Delete the 'pruebas' section completely
  await db.execute(sql`
    DO $$
    BEGIN
      -- Delete versions relations and versions of old test articles
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_articles_v_version_gallery') THEN
        DELETE FROM "_articles_v_version_gallery" WHERE "_version_id" IN (
          SELECT "id" FROM "_articles_v" WHERE "version_published_at" < '2026-09-01' 
          OR "version_section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_articles_v_version_populated_authors') THEN
        DELETE FROM "_articles_v_version_populated_authors" WHERE "_version_id" IN (
          SELECT "id" FROM "_articles_v" WHERE "version_published_at" < '2026-09-01' 
          OR "version_section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_articles_v_rels') THEN
        DELETE FROM "_articles_v_rels" WHERE "parent_id" IN (
          SELECT "id" FROM "_articles_v" WHERE "version_published_at" < '2026-09-01' 
          OR "version_section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_articles_v') THEN
        DELETE FROM "_articles_v" WHERE "version_published_at" < '2026-09-01' 
        OR "version_section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas');
      END IF;

      -- Delete article gallery, populated authors, relations, and articles
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'articles_gallery') THEN
        DELETE FROM "articles_gallery" WHERE "_parent_id" IN (
          SELECT "id" FROM "articles" WHERE "published_at" < '2026-09-01' 
          OR "section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'articles_populated_authors') THEN
        DELETE FROM "articles_populated_authors" WHERE "_parent_id" IN (
          SELECT "id" FROM "articles" WHERE "published_at" < '2026-09-01' 
          OR "section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'articles_rels') THEN
        DELETE FROM "articles_rels" WHERE "parent_id" IN (
          SELECT "id" FROM "articles" WHERE "published_at" < '2026-09-01' 
          OR "section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas')
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'articles') THEN
        DELETE FROM "articles" WHERE "published_at" < '2026-09-01' 
        OR "section_id" IN (SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas');
      END IF;

      -- Delete breadcrumbs and the pruebas section itself
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sections_breadcrumbs') THEN
        DELETE FROM "sections_breadcrumbs" WHERE "parent_id" IN (
          SELECT "id" FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas'
        );
      END IF;

      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sections') THEN
        DELETE FROM "sections" WHERE LOWER("slug") = 'pruebas' OR LOWER("name") = 'pruebas';
      END IF;
    END $$;
  `)
}

export async function down({ db: _db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  // Test data removal is intentional and irreversible
}
