/**
 * Plain-language metric definitions, shown in tooltips. Kept next to the formulas so
 * the explanation and the math stay in sync.
 */
export const METRIC_DEFINITIONS = {
  revenue: {
    label: "Revenue",
    formula: "Gross sales + shipping charged − discounts − refunds",
    help: "Net revenue: what you actually keep from customers.",
  },
  adSpend: { label: "Ad Spend", formula: "Σ daily spend across ad accounts", help: "Total advertising cost." },
  netProfit: {
    label: "Net Profit",
    formula: "Revenue − COGS − shipping − payment fees − variable costs − taxes − ad spend",
    help: "What you really earn after every variable cost and advertising.",
  },
  netMargin: { label: "Net Margin", formula: "Net profit ÷ revenue", help: "Share of revenue you keep as profit." },
  roas: { label: "ROAS", formula: "Revenue ÷ ad spend", help: "Revenue per euro of ad spend. Ignores costs." },
  poas: {
    label: "POAS",
    formula: "Contribution before ads ÷ ad spend",
    help: "Profit on ad spend. Above 1.00× means ads pay for themselves after product costs.",
  },
  mer: {
    label: "MER",
    formula: "Total sales (before refunds) ÷ total ad spend",
    help: "Blended efficiency, independent of attribution.",
  },
  orders: { label: "Orders", formula: "Count of non-cancelled orders", help: "Orders placed in the period." },
  aov: { label: "AOV", formula: "Total sales ÷ orders", help: "Average order value, before refunds." },
  cpa: {
    label: "CPA",
    formula: "Ad spend ÷ new customers",
    help: "Blended cost to acquire one new customer.",
  },
  breakEvenCpa: {
    label: "Break-even CPA",
    formula: "Contribution before ads ÷ orders",
    help: "The most you can pay per order before losing money.",
  },
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
