/**
 * Diagnose test tenant — controleer of het schema bestaat en data heeft.
 *
 * Gebruik:
 *   DATABASE_URL="<beheer-db-url>" TENANT_DB_URL="<tenant-db-url>" npx tsx scripts/diagnose-test-tenant.ts
 *
 * @module scripts/diagnose-test-tenant
 */

import { Client } from "pg";

const BEHEER_DB_URL = process.env.DATABASE_URL;
const TENANT_DB_URL = process.env.TENANT_DB_URL;

async function diagnose() {
  if (!BEHEER_DB_URL || !TENANT_DB_URL) {
    console.error(
      "❌ Stel DATABASE_URL (beheer) en TENANT_DB_URL (tenant db) in als env vars",
    );
    process.exit(1);
  }

  console.log("🔍 Diagnose test-3 tenant...\n");

  // 1. Zoek tenant in Beheer DB
  const beheerClient = new Client({ connectionString: BEHEER_DB_URL });
  await beheerClient.connect();

  const tenantResult = await beheerClient.query(
    `SELECT id, slug, name, status, "databaseSchema", "isActive" 
     FROM "Tenant" 
     WHERE slug = $1 OR slug LIKE $2`,
    ["test-3", "test-%"],
  );

  if (tenantResult.rows.length === 0) {
    console.error("❌ Geen tenant gevonden met slug 'test-3' in Beheer DB");
    console.log(
      "\n💡 Oplossing: Maak een test tenant aan via provisioning, of update de smoke test URL",
    );
    await beheerClient.end();
    process.exit(1);
  }

  console.log("📋 Tenant records gevonden:");
  for (const row of tenantResult.rows) {
    console.log(
      `  - slug: ${row.slug}, schema: ${row.databaseSchema}, status: ${row.status}, active: ${row.isActive}`,
    );
  }

  const testTenant = tenantResult.rows.find(
    (r: Record<string, unknown>) => r.slug === "test-3",
  );
  if (!testTenant) {
    console.log(
      "\n⚠️  Geen tenant met exact slug 'test-3'. Beschikbare slugs hierboven.",
    );
    await beheerClient.end();
    process.exit(1);
  }

  await beheerClient.end();

  // 2. Check of schema bestaat in tenant DB
  const tenantClient = new Client({ connectionString: TENANT_DB_URL });
  await tenantClient.connect();

  const schemaResult = await tenantClient.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    [testTenant.databaseSchema],
  );

  if (schemaResult.rows.length === 0) {
    console.log(
      `\n❌ Schema "${testTenant.databaseSchema}" BESTAAT NIET in de tenant database`,
    );
    console.log("\n💡 Oplossingen:");
    console.log(
      "  1. Update databaseSchema in Beheer DB naar een bestaand schema:",
    );
    console.log(
      `     UPDATE "Tenant" SET "databaseSchema" = 'tenant_518970' WHERE slug = 'test-3';`,
    );
    console.log("  2. Of maak het schema aan via provisioning endpoint");
  } else {
    console.log(`\n✅ Schema "${testTenant.databaseSchema}" bestaat`);

    // 3. Check of er tabellen in zitten
    const tablesResult = await tenantClient.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [testTenant.databaseSchema],
    );

    console.log(`\n📊 Tabellen in schema (${tablesResult.rows.length}):`);
    for (const row of tablesResult.rows) {
      console.log(`  - ${(row as { table_name: string }).table_name}`);
    }
  }

  // 4. Lijst alle tenant schemas
  const allSchemas = await tenantClient.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name`,
  );
  console.log(
    `\n📁 Alle tenant schemas in de database (${allSchemas.rows.length}):`,
  );
  for (const row of allSchemas.rows) {
    console.log(`  - ${(row as { schema_name: string }).schema_name}`);
  }

  await tenantClient.end();
  console.log("\n✅ Diagnose compleet");
}

diagnose().catch(console.error);
