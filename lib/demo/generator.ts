/**
 * Deterministic demo dataset. Pure function: no DB access, seeded PRNG, so it is fully
 * unit-testable and every demo workspace tells the same story:
 *
 *  - Posture Corrector: profitable overall, but ad set "Broad #3" runs above break-even
 *    CPA, and the supplier raised the unit cost ~10.5 % twelve days ago.
 *  - Sunset Lamp: CPA close to break-even — thin margin; the 2-unit offer helps.
 *  - Phone Mount: strong acquisition headroom.
 *  - ~12 % of orders are organic (no UTM) and stay UNATTRIBUTED.
 *  - Meta-reported purchases are inflated vs. our UTM-matched orders, as in real life.
 *
 * Costs on order lines are snapshotted from the cost history in effect at order time.
 */
import type {
  adAccounts,
  adInsightsDaily,
  adSets,
  ads,
  attributions,
  campaigns,
  offerTiers,
  offers,
  orderLineItems,
  orders,
  productCostHistory,
  products,
  refunds,
  stores,
} from "@/lib/db/schema";
import { addDays, dateInTz, zonedTimeToUtc, type IsoDate } from "@/lib/dates";
import type { FinanceAssumptions } from "@/lib/finance/assumptions";
import { applyBps } from "@/lib/finance/money";

export const DEMO_STORE_EXTERNAL_ID = "demo-store";
export const DEMO_AD_ACCOUNT_EXTERNAL_ID = "act_demo_000001";
export const DEMO_DAYS = 30;

export interface DemoDataset {
  store: typeof stores.$inferInsert;
  products: (typeof products.$inferInsert)[];
  costHistory: (typeof productCostHistory.$inferInsert)[];
  offers: (typeof offers.$inferInsert)[];
  offerTiers: (typeof offerTiers.$inferInsert)[];
  adAccount: typeof adAccounts.$inferInsert;
  campaigns: (typeof campaigns.$inferInsert)[];
  adSets: (typeof adSets.$inferInsert)[];
  ads: (typeof ads.$inferInsert)[];
  insights: (typeof adInsightsDaily.$inferInsert)[];
  orders: (typeof orders.$inferInsert)[];
  lineItems: (typeof orderLineItems.$inferInsert)[];
  refunds: (typeof refunds.$inferInsert)[];
  attributions: (typeof attributions.$inferInsert)[];
}

export interface DemoOptions {
  workspaceId: string;
  currency: string;
  timezone: string;
  now: Date;
  assumptions: FinanceAssumptions;
  seed?: number;
  /** Primary-key generator. IDs must be globally unique, so they never come from the seeded PRNG. */
  newId?: () => string;
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float() {
    return this.next();
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number) {
    return this.next() < p;
  }
  /** Multiplicative noise around 1, e.g. spread 0.25 → [0.75, 1.25]. */
  noise(spread: number) {
    return 1 - spread + this.next() * spread * 2;
  }
  poisson(lambda: number) {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l);
    return k - 1;
  }
  pick<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  token(length: number) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => chars[this.int(0, chars.length - 1)]).join("");
  }
}

// ---------------------------------------------------------------------------
// Scenario definition
// ---------------------------------------------------------------------------

interface ProductSpec {
  key: string;
  title: string;
  slug: string;
  supplierName: string;
  supplierProductId: string;
  /** Cost changes: daysAgo is when the cost became effective. */
  costs: { daysAgo: number; product: number; shipping: number; note?: string }[];
  tiers: { quantity: number; price: number; label: string }[];
  tierWeights: number[];
  refundRate: number;
  campaigns: {
    name: string;
    adSets: { name: string; dailySpend: number; trueCpa: number; trend?: number }[];
  }[];
}

const SCENARIO: ProductSpec[] = [
  {
    key: "A",
    title: "Posture Corrector Pro",
    slug: "posture-corrector-pro",
    supplierName: "Shenzhen Healthcare Store",
    supplierProductId: "1005006123456789",
    costs: [
      { daysAgo: 90, product: 380, shipping: 210 },
      { daysAgo: 12, product: 420, shipping: 210, note: "Supplier price increase" },
    ],
    tiers: [
      { quantity: 1, price: 2990, label: "1 unit" },
      { quantity: 2, price: 4490, label: "2 units — save 25%" },
      { quantity: 3, price: 5990, label: "3 units — save 33%" },
    ],
    tierWeights: [62, 28, 10],
    refundRate: 0.07,
    campaigns: [
      {
        name: "Posture | Broad | CBO",
        adSets: [
          { name: "Broad #1", dailySpend: 2200, trueCpa: 1750 },
          { name: "Broad #3", dailySpend: 950, trueCpa: 3100 },
        ],
      },
      {
        name: "Posture | Interests | ABO",
        adSets: [
          { name: "Office workers", dailySpend: 1400, trueCpa: 2150 },
          { name: "Back pain", dailySpend: 1100, trueCpa: 2450 },
        ],
      },
    ],
  },
  {
    key: "B",
    title: "LED Sunset Lamp",
    slug: "led-sunset-lamp",
    supplierName: "Lumière Home Official Store",
    supplierProductId: "1005005987654321",
    costs: [{ daysAgo: 120, product: 680, shipping: 320 }],
    tiers: [
      { quantity: 1, price: 3490, label: "1 lamp" },
      { quantity: 2, price: 5490, label: "2 lamps — save 21%" },
    ],
    tierWeights: [80, 20],
    refundRate: 0.04,
    campaigns: [
      {
        name: "Sunset Lamp | Broad",
        adSets: [
          { name: "Broad FR 25-45", dailySpend: 1500, trueCpa: 1900 },
          { name: "Home decor", dailySpend: 1200, trueCpa: 2050 },
        ],
      },
    ],
  },
  {
    key: "C",
    title: "Magnetic Phone Mount",
    slug: "magnetic-phone-mount",
    supplierName: "AutoGear Accessories Store",
    supplierProductId: "1005004555666777",
    costs: [{ daysAgo: 150, product: 230, shipping: 140 }],
    tiers: [
      { quantity: 1, price: 2490, label: "1 mount" },
      { quantity: 2, price: 3990, label: "2 mounts — save 20%" },
      { quantity: 3, price: 4990, label: "3 mounts — save 33%" },
    ],
    tierWeights: [55, 32, 13],
    refundRate: 0.025,
    campaigns: [
      {
        name: "Phone Mount | Broad | CBO",
        adSets: [
          { name: "Broad #1", dailySpend: 2000, trueCpa: 1150, trend: 0.012 },
          { name: "Drivers 25-55", dailySpend: 1300, trueCpa: 1350 },
        ],
      },
      {
        name: "Phone Mount | Lookalike 2%",
        adSets: [
          { name: "LAL Purchasers 2%", dailySpend: 1600, trueCpa: 1250 },
          { name: "LAL ATC 3%", dailySpend: 900, trueCpa: 1600 },
        ],
      },
    ],
  },
];

const DISCOUNT_RATE = 0.15;
const DISCOUNT_BPS = 1000;
const ORGANIC_SHARE = 0.12;
const RETURNING_SHARE = 0.08;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateDemoDataset(opts: DemoOptions): DemoDataset {
  const rng = new Rng(opts.seed ?? 42);
  const newId = opts.newId ?? (() => crypto.randomUUID());
  const { workspaceId, currency, timezone, assumptions } = opts;
  const today = dateInTz(opts.now, timezone);
  const firstDay = addDays(today, -(DEMO_DAYS - 1));
  const daysAgoToInstant = (daysAgo: number) => zonedTimeToUtc(addDays(today, -daysAgo), 0, 0, timezone);

  const storeId = newId();
  const adAccountId = newId();
  const out: DemoDataset = {
    store: {
      id: storeId,
      workspaceId,
      platform: "DEMO",
      externalId: DEMO_STORE_EXTERNAL_ID,
      name: "Demo Store",
      domain: "demo-store.myshopify.com",
      currency,
      timezone,
    },
    adAccount: {
      id: adAccountId,
      workspaceId,
      platform: "META",
      externalId: DEMO_AD_ACCOUNT_EXTERNAL_ID,
      name: "Demo Ad Account",
      currency,
      timezone,
    },
    products: [],
    costHistory: [],
    offers: [],
    offerTiers: [],
    campaigns: [],
    adSets: [],
    ads: [],
    insights: [],
    orders: [],
    lineItems: [],
    refunds: [],
    attributions: [],
  };

  let orderSeq = 1001;
  let externalSeq = 5_000_000_000;

  for (const spec of SCENARIO) {
    const productId = newId();
    const offerId = newId();
    out.products.push({
      id: productId,
      workspaceId,
      storeId,
      externalId: `demo-product-${spec.key}`,
      title: spec.title,
      imageUrl: null,
      status: "ACTIVE",
      supplierProvider: "ALIEXPRESS",
      supplierName: spec.supplierName,
      supplierUrl: `https://www.aliexpress.com/item/${spec.supplierProductId}.html`,
      supplierProductId: spec.supplierProductId,
      sellingPriceCents: spec.tiers[0].price,
      currency,
    });

    const costTimeline = spec.costs.map((c) => ({ ...c, from: daysAgoToInstant(c.daysAgo) }));
    for (const c of costTimeline) {
      out.costHistory.push({
        workspaceId,
        productId,
        productCostCents: c.product,
        shippingCostCents: c.shipping,
        otherCostCents: 0,
        currency,
        productCostSource: "MANUAL",
        shippingCostSource: "MANUAL",
        effectiveFrom: c.from,
        note: c.note ?? "Initial cost (demo)",
      });
    }
    const costAt = (instant: Date) => {
      let current = costTimeline[0];
      for (const c of costTimeline) if (c.from <= instant) current = c;
      return current;
    };

    out.offers.push({
      id: offerId,
      workspaceId,
      productId,
      name: `${spec.title} — bundles`,
      market: "FR",
      currency,
      status: "ACTIVE",
      strategy: "BALANCED",
    });
    const tierIds = spec.tiers.map(() => newId());
    spec.tiers.forEach((t, i) =>
      out.offerTiers.push({
        id: tierIds[i],
        workspaceId,
        offerId,
        label: t.label,
        quantity: t.quantity,
        priceCents: t.price,
        compareAtPriceCents: spec.tiers[0].price * t.quantity,
        position: i,
      }),
    );

    /** Creates one order (with line, attribution and possibly a refund). */
    const createOrder = (
      day: IsoDate,
      source: { campaignId: string; adSetId: string; adId: string; campaignExt: string; adExt: string } | null,
    ) => {
      const orderId = newId();
      const orderedAt = zonedTimeToUtc(day, rng.int(7, 23), rng.int(0, 59), timezone);
      if (orderedAt > opts.now) return null;
      const tierIndex = rng.pick(
        spec.tiers.map((_, i) => i),
        spec.tierWeights,
      );
      const tier = spec.tiers[tierIndex];
      const cost = costAt(orderedAt);
      const discounted = rng.chance(DISCOUNT_RATE);
      const discountsCents = discounted ? applyBps(tier.price, DISCOUNT_BPS) : 0;
      const total = tier.price - discountsCents;
      const unitCost = cost.product;
      const fbclid = source && rng.chance(0.7) ? `IwAR${rng.token(24)}` : null;

      out.orders.push({
        id: orderId,
        workspaceId,
        storeId,
        externalId: String(externalSeq++),
        orderNumber: `#${orderSeq++}`,
        orderedAt,
        currency,
        subtotalCents: tier.price,
        discountsCents,
        shippingRevenueCents: 0,
        taxCents: 0,
        totalRevenueCents: total,
        refundedCents: 0,
        shippingCostCents: cost.shipping * tier.quantity,
        paymentFeesCents: applyBps(total, assumptions.paymentFeeBps) + assumptions.paymentFixedFeeCents,
        paymentFeesKind: "ESTIMATED",
        customerExternalId: `demo-customer-${rng.token(10)}`,
        isFirstOrder: !rng.chance(RETURNING_SHARE),
        financialStatus: "PAID",
        utmSource: source ? "meta" : null,
        utmMedium: source ? "paid_social" : null,
        utmCampaign: source?.campaignExt ?? null,
        utmContent: source?.adExt ?? null,
        landingPage: `/products/${spec.slug}${source ? `?utm_source=meta&utm_content=${source.adExt}` : ""}`,
        referringSite: source ? "https://l.facebook.com/" : rng.chance(0.5) ? "https://www.google.com/" : null,
        fbclid,
      });
      out.lineItems.push({
        workspaceId,
        orderId,
        externalId: String(externalSeq++),
        productId,
        offerTierId: tierIds[tierIndex],
        title: `${spec.title} — ${tier.label}`,
        quantity: tier.quantity,
        unitPriceCents: Math.round(tier.price / tier.quantity),
        discountCents: discountsCents,
        unitCostCents: unitCost,
        cogsCents: unitCost * tier.quantity,
        cogsKind: "ACTUAL",
      });
      out.attributions.push(
        source
          ? {
              workspaceId,
              orderId,
              method: "UTM_MATCH",
              campaignId: source.campaignId,
              adSetId: source.adSetId,
              adId: source.adId,
              confidence: 90,
              matchedOn: { utm_campaign: source.campaignExt, utm_content: source.adExt },
            }
          : { workspaceId, orderId, method: "UNATTRIBUTED", confidence: 0, matchedOn: {} },
      );

      if (rng.chance(spec.refundRate)) {
        const refundedAt = new Date(orderedAt.getTime() + rng.int(2, 9) * 86_400_000);
        if (refundedAt <= opts.now) {
          out.refunds.push({
            workspaceId,
            orderId,
            externalId: String(externalSeq++),
            amountCents: total,
            currency,
            refundedAt,
          });
          const o = out.orders[out.orders.length - 1];
          o.refundedCents = total;
          o.financialStatus = "REFUNDED";
        }
      }
      return orderId;
    };

    let paidOrders = 0;
    for (const [ci, cs] of spec.campaigns.entries()) {
      const campaignId = newId();
      const campaignExt = `2385${spec.key.charCodeAt(0)}${ci}${rng.int(100000, 999999)}`;
      out.campaigns.push({
        id: campaignId,
        workspaceId,
        adAccountId,
        externalId: campaignExt,
        name: cs.name,
        status: "ACTIVE",
        objective: "OUTCOME_SALES",
        productId,
      });

      for (const [ai, as] of cs.adSets.entries()) {
        const adSetId = newId();
        out.adSets.push({
          id: adSetId,
          workspaceId,
          campaignId,
          externalId: `${campaignExt}${ai}${rng.int(1000, 9999)}`,
          name: as.name,
          status: "ACTIVE",
        });

        const creatives = ["UGC Hook — Problem/Solution", "Static — Before/After"];
        const adIds = creatives.map(() => ({ id: newId(), ext: `${campaignExt}${ai}${rng.int(100000, 999999)}` }));
        creatives.forEach((name, k) =>
          out.ads.push({
            id: adIds[k].id,
            workspaceId,
            adSetId,
            campaignId,
            externalId: adIds[k].ext,
            name: `${as.name} — ${name}`,
            status: "ACTIVE",
          }),
        );

        for (let d = 0; d < DEMO_DAYS; d++) {
          const day = addDays(firstDay, d);
          const trend = 1 + (as.trend ?? 0) * d;
          const adSetSpend = Math.round(as.dailySpend * trend * rng.noise(0.3));
          // Split between the two creatives (60/40 with noise).
          const share = 0.6 * rng.noise(0.15);
          const spends = [Math.round(adSetSpend * share), adSetSpend - Math.round(adSetSpend * share)];
          spends.forEach((spend, k) => {
            const ad = adIds[k];
            const expected = spend / (as.trueCpa * (k === 0 ? 0.92 : 1.12));
            const n = rng.poisson(expected);
            let ourValue = 0;
            let ourCount = 0;
            for (let i = 0; i < n; i++) {
              const id = createOrder(day, {
                campaignId,
                adSetId,
                adId: ad.id,
                campaignExt,
                adExt: ad.ext,
              });
              if (id) {
                ourCount++;
                paidOrders++;
                ourValue += out.orders[out.orders.length - 1].totalRevenueCents ?? 0;
              }
            }
            // Meta over-reports (view-through, cross-device, modelled conversions).
            const inflation = 1.1 + rng.float() * 0.25;
            const impressions = Math.round((spend / 100) * rng.int(70, 110));
            out.insights.push({
              workspaceId,
              adId: ad.id,
              date: day,
              currency,
              spendCents: spend,
              impressions,
              reach: Math.round(impressions * rng.noise(0.1) * 0.72),
              clicks: Math.round(impressions * (0.009 + rng.float() * 0.012)),
              metaPurchases: Math.round(ourCount * inflation),
              metaPurchaseValueCents: Math.round(ourValue * inflation),
            });
          });
        }
      }
    }

    // Organic / unattributed orders.
    const organic = Math.round((paidOrders * ORGANIC_SHARE) / (1 - ORGANIC_SHARE));
    for (let i = 0; i < organic; i++) createOrder(addDays(firstDay, rng.int(0, DEMO_DAYS - 1)), null);
  }

  return out;
}
