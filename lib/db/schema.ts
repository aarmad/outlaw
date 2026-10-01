/**
 * Outlaw database schema.
 *
 * Conventions
 * - Every monetary amount is an integer number of MINOR UNITS (cents) in a `*_cents`
 *   column, stored as BIGINT and paired with a `currency` column (ISO 4217) wherever
 *   it can vary. Floats are never used for money.
 * - Rates/percentages are integer BASIS POINTS (`*_bps`): 2.9 % = 290 bps.
 * - Every business table carries `workspace_id`. All reads/writes go through the
 *   workspace-scoped data layer (lib/db/queries), never directly from components.
 * - Rows coming from external platforms keep the platform id in `external_id`, with a
 *   unique constraint so that syncs are idempotent upserts.
 * - RLS is enabled on every table with no policies: the app connects with a privileged
 *   server role, and Supabase's public Data API (anon / authenticated keys) gets nothing.
 */
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const cents = (name: string) => bigint(name, { mode: "number" });
const currency = () => text("currency").notNull();
const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRole = pgEnum("member_role", ["OWNER", "ADMIN", "MEMBER"]);
export const storePlatform = pgEnum("store_platform", ["SHOPIFY", "DEMO"]);
export const integrationProvider = pgEnum("integration_provider", ["SHOPIFY", "META", "ALIEXPRESS"]);
export const integrationStatus = pgEnum("integration_status", [
  "CONNECTED",
  "DISCONNECTED",
  "ERROR",
  "SYNCING",
]);
export const productStatus = pgEnum("product_status", ["TESTING", "ACTIVE", "PAUSED", "ARCHIVED"]);
/** Where a cost value came from: an API we trust, or typed in by the user. */
export const dataSource = pgEnum("data_source", ["API", "MANUAL"]);
/** Whether a figure is a real observed value or an estimate from settings. */
export const valueKind = pgEnum("value_kind", ["ACTUAL", "ESTIMATED"]);
export const vatMode = pgEnum("vat_mode", ["NONE", "INCLUDED"]);
export const offerStatus = pgEnum("offer_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const offerStrategy = pgEnum("offer_strategy", [
  "CONSERVATIVE",
  "BALANCED",
  "AGGRESSIVE",
  "CUSTOM",
]);
export const adPlatform = pgEnum("ad_platform", ["META"]);
export const attributionMethod = pgEnum("attribution_method", [
  "DIRECT_MATCH",
  "UTM_MATCH",
  "INFERRED",
  "UNATTRIBUTED",
]);
export const syncStatus = pgEnum("sync_status", ["PENDING", "RUNNING", "SUCCESS", "FAILED"]);
export const logLevel = pgEnum("log_level", ["INFO", "WARN", "ERROR"]);
export const insightSeverity = pgEnum("insight_severity", ["INFO", "OPPORTUNITY", "WARNING", "CRITICAL"]);

// ---------------------------------------------------------------------------
// Identity & tenancy
// ---------------------------------------------------------------------------

/** Mirror of Supabase `auth.users` (same id). Created on first authenticated request. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  demoMode: boolean("demo_mode").notNull().default(false),
  demoSeededAt: timestamp("demo_seeded_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("MEMBER"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("workspace_members_ws_user_uq").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
).enableRLS();

/** Financial assumptions used for simulations and for estimating missing actuals. */
export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  paymentFeeBps: integer("payment_fee_bps").notNull().default(290),
  paymentFixedFeeCents: cents("payment_fixed_fee_cents").notNull().default(30),
  refundBufferBps: integer("refund_buffer_bps").notNull().default(300),
  vatMode: vatMode("vat_mode").notNull().default("NONE"),
  vatRateBps: integer("vat_rate_bps").notNull().default(2000),
  otherVariableCostBps: integer("other_variable_cost_bps").notNull().default(0),
  targetNetMarginBps: integer("target_net_margin_bps").notNull().default(1500),
  targetCpaBufferBps: integer("target_cpa_buffer_bps").notNull().default(2000),
  refundRateThresholdBps: integer("refund_rate_threshold_bps").notNull().default(500),
  /** Price endings in cents, e.g. [90, 95, 99]. */
  priceEndings: jsonb("price_endings").$type<number[]>().notNull().default([90, 95, 99]),
  updatedAt: updatedAt(),
}).enableRLS();

// ---------------------------------------------------------------------------
// Stores & integrations
// ---------------------------------------------------------------------------

export const stores = pgTable(
  "stores",
  {
    id: id(),
    workspaceId: workspaceRef(),
    platform: storePlatform("platform").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    domain: text("domain"),
    currency: currency(),
    timezone: text("timezone"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("stores_ws_platform_ext_uq").on(t.workspaceId, t.platform, t.externalId),
    index("stores_workspace_idx").on(t.workspaceId),
  ],
).enableRLS();

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    workspaceId: workspaceRef(),
    provider: integrationProvider("provider").notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    status: integrationStatus("status").notNull().default("DISCONNECTED"),
    accountName: text("account_name"),
    externalAccountId: text("external_account_id"),
    /** AES-256-GCM ciphertext (see lib/security/crypto.ts). Never sent to the client. */
    accessTokenEncrypted: text("access_token_encrypted"),
    scopes: text("scopes"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("integrations_ws_provider_account_uq").on(
      t.workspaceId,
      t.provider,
      t.externalAccountId,
    ),
    index("integrations_workspace_idx").on(t.workspaceId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Catalog & costs
// ---------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: id(),
    workspaceId: workspaceRef(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    status: productStatus("status").notNull().default("TESTING"),
    supplierProvider: text("supplier_provider"),
    supplierName: text("supplier_name"),
    supplierUrl: text("supplier_url"),
    supplierProductId: text("supplier_product_id"),
    sellingPriceCents: cents("selling_price_cents"),
    currency: currency(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_workspace_idx").on(t.workspaceId),
    uniqueIndex("products_store_ext_uq").on(t.storeId, t.externalId),
  ],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    workspaceId: workspaceRef(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    sku: text("sku"),
    priceCents: cents("price_cents"),
    currency: currency(),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    uniqueIndex("product_variants_product_ext_uq").on(t.productId, t.externalId),
  ],
).enableRLS();

/**
 * Append-only cost history. The cost in effect at time T is the row with the greatest
 * `effective_from <= T` for (product, variant?, country?). Never updated in place, so
 * historical COGS can always be reconstructed.
 */
export const productCostHistory = pgTable(
  "product_cost_history",
  {
    id: id(),
    workspaceId: workspaceRef(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Null = applies to all variants. */
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    /** ISO country code; null = all destinations. */
    countryCode: text("country_code"),
    productCostCents: cents("product_cost_cents").notNull(),
    shippingCostCents: cents("shipping_cost_cents").notNull(),
    otherCostCents: cents("other_cost_cents").notNull().default(0),
    currency: currency(),
    productCostSource: dataSource("product_cost_source").notNull().default("MANUAL"),
    shippingCostSource: dataSource("shipping_cost_source").notNull().default("MANUAL"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_cost_history_lookup_idx").on(t.productId, t.variantId, t.effectiveFrom),
    index("product_cost_history_workspace_idx").on(t.workspaceId),
  ],
).enableRLS();

export const offers = pgTable(
  "offers",
  {
    id: id(),
    workspaceId: workspaceRef(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    market: text("market"),
    currency: currency(),
    status: offerStatus("status").notNull().default("DRAFT"),
    strategy: offerStrategy("strategy").notNull().default("CUSTOM"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("offers_workspace_idx").on(t.workspaceId),
    index("offers_product_idx").on(t.productId),
  ],
).enableRLS();

export const offerTiers = pgTable(
  "offer_tiers",
  {
    id: id(),
    workspaceId: workspaceRef(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    label: text("label"),
    quantity: integer("quantity").notNull(),
    priceCents: cents("price_cents").notNull(),
    compareAtPriceCents: cents("compare_at_price_cents"),
    /** Per-order shipping cost override for this tier. Null = quantity × unit shipping. */
    shippingCostCents: cents("shipping_cost_cents"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("offer_tiers_offer_qty_uq").on(t.offerId, t.quantity)],
).enableRLS();

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: id(),
    workspaceId: workspaceRef(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    orderNumber: text("order_number").notNull(),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    currency: currency(),
    /** Sum of line prices × quantities, before discounts. */
    subtotalCents: cents("subtotal_cents").notNull(),
    discountsCents: cents("discounts_cents").notNull().default(0),
    /** Shipping charged to the customer. */
    shippingRevenueCents: cents("shipping_revenue_cents").notNull().default(0),
    taxCents: cents("tax_cents").notNull().default(0),
    totalRevenueCents: cents("total_revenue_cents").notNull(),
    /** Denormalised sum of `refunds.amount_cents` for fast aggregation. */
    refundedCents: cents("refunded_cents").notNull().default(0),
    /** Our shipping cost to the supplier/carrier (not what the customer paid). */
    shippingCostCents: cents("shipping_cost_cents").notNull().default(0),
    paymentFeesCents: cents("payment_fees_cents").notNull().default(0),
    paymentFeesKind: valueKind("payment_fees_kind").notNull().default("ESTIMATED"),
    customerExternalId: text("customer_external_id"),
    isFirstOrder: boolean("is_first_order").notNull().default(true),
    financialStatus: text("financial_status"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    landingPage: text("landing_page"),
    referringSite: text("referring_site"),
    fbclid: text("fbclid"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_store_ext_uq").on(t.storeId, t.externalId),
    index("orders_ws_ordered_at_idx").on(t.workspaceId, t.orderedAt),
  ],
).enableRLS();

export const orderLineItems = pgTable(
  "order_line_items",
  {
    id: id(),
    workspaceId: workspaceRef(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    offerTierId: uuid("offer_tier_id").references(() => offerTiers.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: cents("unit_price_cents").notNull(),
    discountCents: cents("discount_cents").notNull().default(0),
    /** Unit product+other cost snapshotted from cost history at order time. */
    unitCostCents: cents("unit_cost_cents").notNull().default(0),
    cogsCents: cents("cogs_cents").notNull().default(0),
    cogsKind: valueKind("cogs_kind").notNull().default("ESTIMATED"),
    createdAt: createdAt(),
  },
  (t) => [
    index("order_line_items_order_idx").on(t.orderId),
    index("order_line_items_ws_product_idx").on(t.workspaceId, t.productId),
    uniqueIndex("order_line_items_order_ext_uq").on(t.orderId, t.externalId),
  ],
).enableRLS();

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    workspaceId: workspaceRef(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    amountCents: cents("amount_cents").notNull(),
    currency: currency(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("refunds_order_ext_uq").on(t.orderId, t.externalId),
    index("refunds_ws_refunded_at_idx").on(t.workspaceId, t.refundedAt),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Advertising
// ---------------------------------------------------------------------------

export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid("integration_id").references(() => integrations.id, {
      onDelete: "set null",
    }),
    platform: adPlatform("platform").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    currency: currency(),
    timezone: text("timezone"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("ad_accounts_ws_platform_ext_uq").on(t.workspaceId, t.platform, t.externalId)],
).enableRLS();

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    workspaceId: workspaceRef(),
    adAccountId: uuid("ad_account_id")
      .notNull()
      .references(() => adAccounts.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    objective: text("objective"),
    /** User-configured mapping: which product this campaign promotes. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("campaigns_account_ext_uq").on(t.adAccountId, t.externalId),
    index("campaigns_workspace_idx").on(t.workspaceId),
    index("campaigns_product_idx").on(t.productId),
  ],
).enableRLS();

export const adSets = pgTable(
  "ad_sets",
  {
    id: id(),
    workspaceId: workspaceRef(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("ad_sets_campaign_ext_uq").on(t.campaignId, t.externalId),
    index("ad_sets_workspace_idx").on(t.workspaceId),
  ],
).enableRLS();

export const ads = pgTable(
  "ads",
  {
    id: id(),
    workspaceId: workspaceRef(),
    adSetId: uuid("ad_set_id")
      .notNull()
      .references(() => adSets.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    /** Optional override of the campaign-level product mapping. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("ads_adset_ext_uq").on(t.adSetId, t.externalId),
    index("ads_workspace_idx").on(t.workspaceId),
    index("ads_campaign_idx").on(t.campaignId),
  ],
).enableRLS();

/**
 * One row per ad per day (ad-account timezone). Campaign/ad set totals are always
 * rebuilt from this table so any date range can be reconstructed.
 * Purchase metrics are META-REPORTED and must be labelled as such in the UI.
 */
export const adInsightsDaily = pgTable(
  "ad_insights_daily",
  {
    id: id(),
    workspaceId: workspaceRef(),
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    currency: currency(),
    spendCents: cents("spend_cents").notNull().default(0),
    impressions: bigint("impressions", { mode: "number" }).notNull().default(0),
    reach: bigint("reach", { mode: "number" }),
    clicks: bigint("clicks", { mode: "number" }).notNull().default(0),
    metaPurchases: integer("meta_purchases").notNull().default(0),
    metaPurchaseValueCents: cents("meta_purchase_value_cents").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("ad_insights_daily_ad_date_uq").on(t.adId, t.date),
    index("ad_insights_daily_ws_date_idx").on(t.workspaceId, t.date),
  ],
).enableRLS();

/** Our own attribution of an order to an ad, independent of Meta's reporting. */
export const attributions = pgTable(
  "attributions",
  {
    id: id(),
    workspaceId: workspaceRef(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    method: attributionMethod("method").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    adSetId: uuid("ad_set_id").references(() => adSets.id, { onDelete: "set null" }),
    adId: uuid("ad_id").references(() => ads.id, { onDelete: "set null" }),
    /** 0–100. */
    confidence: integer("confidence").notNull().default(0),
    matchedOn: jsonb("matched_on").$type<Record<string, string>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("attributions_order_uq").on(t.orderId),
    index("attributions_ws_campaign_idx").on(t.workspaceId, t.campaignId),
    index("attributions_ad_set_idx").on(t.adSetId),
    index("attributions_ad_idx").on(t.adId),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Sync & insights
// ---------------------------------------------------------------------------

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid("integration_id").references(() => integrations.id, {
      onDelete: "cascade",
    }),
    provider: integrationProvider("provider").notNull(),
    type: text("type").notNull(),
    status: syncStatus("status").notNull().default("PENDING"),
    /** Resumable pagination cursor so a job can continue after a serverless timeout. */
    cursor: jsonb("cursor").$type<Record<string, unknown>>(),
    attempt: integer("attempt").notNull().default(0),
    recordsProcessed: integer("records_processed").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sync_jobs_ws_status_idx").on(t.workspaceId, t.status),
    index("sync_jobs_integration_idx").on(t.integrationId, t.createdAt),
  ],
).enableRLS();

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: id(),
    workspaceId: workspaceRef(),
    syncJobId: uuid("sync_job_id")
      .notNull()
      .references(() => syncJobs.id, { onDelete: "cascade" }),
    level: logLevel("level").notNull().default("INFO"),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sync_logs_job_idx").on(t.syncJobId, t.createdAt)],
).enableRLS();

export const insights = pgTable(
  "insights",
  {
    id: id(),
    workspaceId: workspaceRef(),
    ruleId: text("rule_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    severity: insightSeverity("severity").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Figures and formula used, shown to the user for transparency. */
    data: jsonb("data").$type<Record<string, unknown>>(),
    confidence: integer("confidence"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("insights_ws_created_idx").on(t.workspaceId, t.createdAt)],
).enableRLS();
