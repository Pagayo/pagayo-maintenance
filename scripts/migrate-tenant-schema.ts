/**
 * Schema alignment migration script for tenant schemas
 *
 * Run with: npx tsx scripts/migrate-tenant-schema.ts
 */

import { neon } from "@neondatabase/serverless";

// Storefront PRODUCTION database
const DATABASE_URL =
  "postgresql://neondb_owner:npg_5sPYcDaBSRj6@ep-rough-lake-ag7n5yjn-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// IMPORTANT: Set the correct tenant schema to migrate
const SCHEMA_NAME = "tenant_test_3";

async function main() {
  console.log(`🚀 Starting schema alignment for ${SCHEMA_NAME}...`);

  const sql = neon(DATABASE_URL);

  // ============================================
  // 1. NEW ENUM TYPES (IF NOT EXISTS)
  // ============================================
  console.log("\n📦 Creating new enum types...");

  const newEnums: Array<{ name: string; values: string[] }> = [
    {
      name: "ProductType",
      values: ["PHYSICAL", "DIGITAL", "SUBSCRIPTION", "SERVICE"],
    },
    {
      name: "BillingInterval",
      values: ["WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"],
    },
    {
      name: "SubscriptionScope",
      values: ["INDIVIDUAL", "FAMILY", "GROUP"],
    },
    {
      name: "SubscriptionStatus",
      values: [
        "TRIALING",
        "ACTIVE",
        "PAUSED",
        "PAST_DUE",
        "CANCELED",
        "EXPIRED",
      ],
    },
    {
      name: "SubscriptionMemberRole",
      values: ["OWNER", "MEMBER"],
    },
    {
      name: "SubscriptionVisitResult",
      values: [
        "VALID",
        "EXPIRED",
        "PAUSED",
        "CANCELED",
        "NOT_FOUND",
        "INVALID",
      ],
    },
  ];

  for (const enumDef of newEnums) {
    const values = enumDef.values.map((v) => `'${v}'`).join(", ");
    try {
      await sql`
        DO $$ BEGIN
          CREATE TYPE ${sql(SCHEMA_NAME + "." + enumDef.name)} AS ENUM (${sql.unsafe(values)});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
      `;
      console.log(`  ✅ ${enumDef.name}`);
    } catch (e) {
      // Try raw SQL for enum creation
      try {
        await sql.unsafe(`
          DO $$ BEGIN
            CREATE TYPE "${SCHEMA_NAME}"."${enumDef.name}" AS ENUM (${values});
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$
        `);
        console.log(`  ✅ ${enumDef.name}`);
      } catch (e2) {
        console.log(`  ⚠️ ${enumDef.name} - ${(e2 as Error).message}`);
      }
    }
  }

  // Add SUBSCRIPTION to existing enums
  console.log("\n🔧 Updating existing enums...");
  try {
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TYPE "${SCHEMA_NAME}"."OrderSource" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    console.log("  ✅ OrderSource + SUBSCRIPTION");
  } catch (e) {
    console.log(`  ⚠️ OrderSource: ${(e as Error).message}`);
  }

  try {
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TYPE "${SCHEMA_NAME}"."OrderItemType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    console.log("  ✅ OrderItemType + SUBSCRIPTION");
  } catch (e) {
    console.log(`  ⚠️ OrderItemType: ${(e as Error).message}`);
  }

  // ============================================
  // 2. ALTER EXISTING TABLES — add missing columns
  // ============================================
  console.log("\n🔧 Adding missing columns to existing tables...");

  const columnAdditions: Array<{
    table: string;
    col: string;
    type: string;
    defaultVal?: string;
  }> = [
    // Product columns
    {
      table: "Product",
      col: "lowStockThreshold",
      type: "INTEGER NOT NULL",
      defaultVal: "5",
    },
    {
      table: "Product",
      col: "hasVariants",
      type: "BOOLEAN NOT NULL",
      defaultVal: "false",
    },
    { table: "Product", col: "variantOptions", type: "JSONB" },
    {
      table: "Product",
      col: "productType",
      type: `"${SCHEMA_NAME}"."ProductType" NOT NULL`,
      defaultVal: "'PHYSICAL'",
    },
    {
      table: "Product",
      col: "billingInterval",
      type: `"${SCHEMA_NAME}"."BillingInterval"`,
    },
    {
      table: "Product",
      col: "billingIntervalCount",
      type: "INTEGER",
      defaultVal: "1",
    },
    {
      table: "Product",
      col: "subscriptionScope",
      type: `"${SCHEMA_NAME}"."SubscriptionScope"`,
    },
    { table: "Product", col: "maxMembers", type: "INTEGER" },
    { table: "Product", col: "pricePerExtraMember", type: "DECIMAL(10,2)" },
    { table: "Product", col: "trialDays", type: "INTEGER", defaultVal: "0" },

    // Order columns
    { table: "Order", col: "sourceRef", type: "TEXT" },
    { table: "Order", col: "sourceMetadata", type: "JSONB" },
    {
      table: "Order",
      col: "paymentStatus",
      type: "TEXT NOT NULL",
      defaultVal: "'pending'",
    },
    {
      table: "Order",
      col: "discount",
      type: "DECIMAL(10,2) NOT NULL",
      defaultVal: "0",
    },
    {
      table: "Order",
      col: "currency",
      type: "TEXT NOT NULL",
      defaultVal: "'EUR'",
    },

    // Return columns
    {
      table: "Return",
      col: "reasonCategory",
      type: "TEXT NOT NULL",
      defaultVal: "'other'",
    },
    { table: "Return", col: "description", type: "TEXT" },
    { table: "Return", col: "refundedAt", type: "TIMESTAMP(3)" },
    { table: "Return", col: "refundMethod", type: "TEXT" },
    { table: "Return", col: "handledBy", type: "TEXT" },
    { table: "Return", col: "adminNotes", type: "TEXT" },
    { table: "Return", col: "trackingNumber", type: "TEXT" },
    { table: "Return", col: "receivedAt", type: "TIMESTAMP(3)" },

    // Invoice columns
    { table: "Invoice", col: "originalInvoiceId", type: "INTEGER" },
    { table: "Invoice", col: "creditReason", type: "TEXT" },
    {
      table: "Invoice",
      col: "taxRate",
      type: "DECIMAL(5,2) NOT NULL",
      defaultVal: "21",
    },
    {
      table: "Invoice",
      col: "discount",
      type: "DECIMAL(10,2) NOT NULL",
      defaultVal: "0",
    },
    {
      table: "Invoice",
      col: "shippingCost",
      type: "DECIMAL(10,2) NOT NULL",
      defaultVal: "0",
    },
    { table: "Invoice", col: "items", type: "JSONB" },
    { table: "Invoice", col: "sentAt", type: "TIMESTAMP(3)" },

    // Coupon columns
    { table: "Coupon", col: "description", type: "TEXT" },
    {
      table: "Coupon",
      col: "discountType",
      type: "TEXT NOT NULL",
      defaultVal: "'percentage'",
    },
    {
      table: "Coupon",
      col: "discountValue",
      type: "DECIMAL(10,2) NOT NULL",
      defaultVal: "0",
    },
    { table: "Coupon", col: "minimumOrder", type: "DECIMAL(10,2)" },
    { table: "Coupon", col: "maximumDiscount", type: "DECIMAL(10,2)" },
    {
      table: "Coupon",
      col: "usageCount",
      type: "INTEGER NOT NULL",
      defaultVal: "0",
    },
    { table: "Coupon", col: "perUserLimit", type: "INTEGER" },
    { table: "Coupon", col: "startsAt", type: "TIMESTAMP(3)" },
    { table: "Coupon", col: "expiresAt", type: "TIMESTAMP(3)" },
    { table: "Coupon", col: "applicableProducts", type: "JSONB" },
    { table: "Coupon", col: "applicableCategories", type: "JSONB" },
  ];

  for (const { table, col, type, defaultVal } of columnAdditions) {
    const def = defaultVal !== undefined ? ` DEFAULT ${defaultVal}` : "";
    try {
      await sql.unsafe(`
        ALTER TABLE "${SCHEMA_NAME}"."${table}" 
        ADD COLUMN IF NOT EXISTS "${col}" ${type}${def}
      `);
      console.log(`  ✅ ${table}.${col}`);
    } catch (e) {
      console.log(`  ⚠️ ${table}.${col}: ${(e as Error).message}`);
    }
  }

  // ============================================
  // 3. CREATE NEW TABLES (IF NOT EXISTS)
  // ============================================
  console.log("\n🏗️ Creating new tables...");

  const newTables: Array<{ name: string; ddl: string }> = [
    {
      name: "ProductVariant",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."ProductVariant" (
          "id" SERIAL PRIMARY KEY,
          "productId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Product"("id") ON DELETE CASCADE,
          "sku" TEXT,
          "barcode" TEXT,
          "price" DECIMAL(10,2) NOT NULL,
          "comparePrice" DECIMAL(10,2),
          "quantity" INTEGER NOT NULL DEFAULT 0,
          "options" JSONB NOT NULL,
          "imageUrl" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "position" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "ShippingMethod",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."ShippingMethod" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "label" TEXT NOT NULL,
          "description" TEXT,
          "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
          "minOrderValue" DECIMAL(10,2),
          "maxOrderValue" DECIMAL(10,2),
          "freeShippingThreshold" DECIMAL(10,2),
          "carrier" TEXT,
          "estimatedDays" TEXT,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "OrderCoupon",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."OrderCoupon" (
          "id" SERIAL PRIMARY KEY,
          "orderId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Order"("id") ON DELETE CASCADE,
          "couponId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Coupon"("id"),
          "discount" DECIMAL(10,2) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("orderId", "couponId")
        )
      `,
    },
    {
      name: "PackingSlip",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."PackingSlip" (
          "id" SERIAL PRIMARY KEY,
          "packingSlipNumber" TEXT NOT NULL UNIQUE,
          "orderId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Order"("id"),
          "shippingAddress" JSONB NOT NULL,
          "items" JSONB NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'created',
          "printedAt" TIMESTAMP(3),
          "shippedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "PlatformAdminSession",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."PlatformAdminSession" (
          "id" TEXT PRIMARY KEY,
          "organizationUserId" TEXT NOT NULL,
          "organizationId" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "selectedTenantId" TEXT,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "userAgent" TEXT,
          "ipAddress" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "BlogPost",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."BlogPost" (
          "id" SERIAL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "slug" TEXT NOT NULL UNIQUE,
          "excerpt" TEXT,
          "content" TEXT NOT NULL,
          "featuredImage" TEXT,
          "status" TEXT NOT NULL DEFAULT 'draft',
          "publishedAt" TIMESTAMP(3),
          "author" TEXT,
          "authorEmail" TEXT,
          "tags" TEXT[] NOT NULL DEFAULT '{}',
          "metaTitle" TEXT,
          "metaDescription" TEXT,
          "viewCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "AIConfig",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."AIConfig" (
          "id" SERIAL PRIMARY KEY,
          "enabled" BOOLEAN NOT NULL DEFAULT false,
          "suggestionsEnabled" BOOLEAN NOT NULL DEFAULT true,
          "insightsEnabled" BOOLEAN NOT NULL DEFAULT true,
          "autoOptimizeEnabled" BOOLEAN NOT NULL DEFAULT false,
          "suggestionsFrequency" TEXT NOT NULL DEFAULT 'daily',
          "automationLevel" TEXT NOT NULL DEFAULT 'SUGGEST',
          "allowedActions" TEXT[] NOT NULL DEFAULT '{}',
          "businessType" TEXT,
          "onboardingAnswers" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "AIActionLog",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."AIActionLog" (
          "id" SERIAL PRIMARY KEY,
          "actionType" TEXT NOT NULL,
          "intentCode" TEXT NOT NULL,
          "context" JSONB NOT NULL,
          "suggestion" JSONB,
          "executedAction" JSONB,
          "userAccepted" BOOLEAN,
          "userModified" BOOLEAN,
          "userFeedback" TEXT,
          "suggestedAt" TIMESTAMP(3),
          "respondedAt" TIMESTAMP(3),
          "executedAt" TIMESTAMP(3),
          "aiModel" TEXT,
          "confidence" REAL,
          "processingTimeMs" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "InsightLog",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."InsightLog" (
          "id" SERIAL PRIMARY KEY,
          "type" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "priority" TEXT NOT NULL DEFAULT 'medium',
          "title" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "metric" TEXT,
          "metricValue" REAL,
          "changePercent" REAL,
          "dataSnapshot" JSONB,
          "aiModel" TEXT,
          "confidence" REAL,
          "dismissedAt" TIMESTAMP(3),
          "actedOnAt" TIMESTAMP(3),
          "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "validUntil" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "Subscription",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."Subscription" (
          "id" SERIAL PRIMARY KEY,
          "productId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Product"("id"),
          "userId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."User"("id"),
          "status" "${SCHEMA_NAME}"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
          "currentPeriodStart" TIMESTAMP(3) NOT NULL,
          "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
          "trialEndsAt" TIMESTAMP(3),
          "canceledAt" TIMESTAMP(3),
          "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
          "pausedAt" TIMESTAMP(3),
          "resumesAt" TIMESTAMP(3),
          "priceAtPurchase" DECIMAL(10,2) NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'EUR',
          "memberCount" INTEGER NOT NULL DEFAULT 1,
          "passCode" TEXT NOT NULL UNIQUE,
          "lastPaymentAt" TIMESTAMP(3),
          "lastPaymentOrderId" INTEGER REFERENCES "${SCHEMA_NAME}"."Order"("id"),
          "failedPaymentCount" INTEGER NOT NULL DEFAULT 0,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "SubscriptionMember",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."SubscriptionMember" (
          "id" SERIAL PRIMARY KEY,
          "subscriptionId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Subscription"("id") ON DELETE CASCADE,
          "userId" INTEGER REFERENCES "${SCHEMA_NAME}"."User"("id"),
          "role" "${SCHEMA_NAME}"."SubscriptionMemberRole" NOT NULL DEFAULT 'MEMBER',
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "email" TEXT,
          "dateOfBirth" TEXT,
          "memberPassCode" TEXT NOT NULL UNIQUE,
          "photoUrl" TEXT,
          "photoUploadedAt" TIMESTAMP(3),
          "photoRequired" BOOLEAN NOT NULL DEFAULT true,
          "status" TEXT NOT NULL DEFAULT 'active',
          "invitedAt" TIMESTAMP(3),
          "joinedAt" TIMESTAMP(3),
          "removedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "SubscriptionEvent",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."SubscriptionEvent" (
          "id" SERIAL PRIMARY KEY,
          "subscriptionId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Subscription"("id") ON DELETE CASCADE,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "details" JSONB,
          "actor" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: "SubscriptionVisit",
      ddl: `
        CREATE TABLE IF NOT EXISTS "${SCHEMA_NAME}"."SubscriptionVisit" (
          "id" SERIAL PRIMARY KEY,
          "subscriptionId" INTEGER NOT NULL REFERENCES "${SCHEMA_NAME}"."Subscription"("id") ON DELETE CASCADE,
          "memberId" INTEGER REFERENCES "${SCHEMA_NAME}"."SubscriptionMember"("id") ON DELETE SET NULL,
          "passCode" TEXT NOT NULL,
          "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "validationResult" "${SCHEMA_NAME}"."SubscriptionVisitResult" NOT NULL,
          "scanSource" TEXT NOT NULL DEFAULT 'MANUAL',
          "scannedByUserId" INTEGER REFERENCES "${SCHEMA_NAME}"."User"("id"),
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
  ];

  for (const { name, ddl } of newTables) {
    try {
      await sql.unsafe(ddl);
      console.log(`  ✅ ${name}`);
    } catch (e) {
      console.log(`  ⚠️ ${name}: ${(e as Error).message}`);
    }
  }

  // ============================================
  // 4. CREATE INDEXES for new tables
  // ============================================
  console.log("\n📇 Creating indexes...");

  const indexes: Array<{
    name: string;
    table: string;
    columns: string;
    unique?: boolean;
  }> = [
    {
      name: "product_variant_product_idx",
      table: "ProductVariant",
      columns: '"productId"',
    },
    {
      name: "product_variant_status_idx",
      table: "ProductVariant",
      columns: '"status"',
    },
    {
      name: "shipping_method_active_idx",
      table: "ShippingMethod",
      columns: '"isActive"',
    },
    {
      name: "order_coupon_order_idx",
      table: "OrderCoupon",
      columns: '"orderId"',
    },
    {
      name: "packing_slip_order_idx",
      table: "PackingSlip",
      columns: '"orderId"',
    },
    {
      name: "platform_session_org_idx",
      table: "PlatformAdminSession",
      columns: '"organizationId"',
    },
    { name: "blog_status_idx", table: "BlogPost", columns: '"status"' },
    {
      name: "subscription_user_idx",
      table: "Subscription",
      columns: '"userId"',
    },
    {
      name: "subscription_product_idx",
      table: "Subscription",
      columns: '"productId"',
    },
    {
      name: "subscription_status_idx",
      table: "Subscription",
      columns: '"status"',
    },
    {
      name: "sub_member_subscription_idx",
      table: "SubscriptionMember",
      columns: '"subscriptionId"',
    },
    {
      name: "sub_event_subscription_idx",
      table: "SubscriptionEvent",
      columns: '"subscriptionId"',
    },
    {
      name: "sub_visit_subscription_idx",
      table: "SubscriptionVisit",
      columns: '"subscriptionId"',
    },
    {
      name: "sub_visit_passcode_idx",
      table: "SubscriptionVisit",
      columns: '"passCode"',
    },
    {
      name: "product_type_idx",
      table: "Product",
      columns: '"productType"',
    },
  ];

  for (const idx of indexes) {
    const unique = idx.unique ? "UNIQUE " : "";
    try {
      await sql.unsafe(`
        CREATE ${unique}INDEX IF NOT EXISTS "${idx.name}" 
        ON "${SCHEMA_NAME}"."${idx.table}"(${idx.columns})
      `);
      console.log(`  ✅ ${idx.name}`);
    } catch (e) {
      console.log(`  ⚠️ ${idx.name}: ${(e as Error).message}`);
    }
  }

  console.log("\n✅ Schema alignment complete!");
}

main().catch(console.error);
