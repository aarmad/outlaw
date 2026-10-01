/**
 * Display formatting only. No business math here — see lib/finance for formulas.
 */
import type { Cents } from "@/lib/finance/money";
import type { Ratio } from "@/lib/finance/ratios";

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CAD", "AUD", "CHF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const LOCALE_BY_CURRENCY: Record<string, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU",
  CHF: "de-CH",
};

export function localeFor(currency: string): string {
  return LOCALE_BY_CURRENCY[currency] ?? "en-US";
}

export const EMPTY_VALUE = "—";

export function formatMoney(
  cents: Cents | null | undefined,
  currency: string,
  opts: { signed?: boolean; compact?: boolean; noDecimals?: boolean } = {},
): string {
  if (cents === null || cents === undefined) return EMPTY_VALUE;
  const value = cents / 100;
  const fmt = new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.noDecimals || opts.compact ? 0 : 2,
    maximumFractionDigits: opts.noDecimals ? 0 : opts.compact ? 1 : 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return fmt.format(value);
}

/** Ratio 0.184 → "18.4 %". */
export function formatPercent(
  ratio: Ratio | undefined,
  opts: { signed?: boolean; digits?: number; currency?: string } = {},
): string {
  if (ratio === null || ratio === undefined) return EMPTY_VALUE;
  return new Intl.NumberFormat(localeFor(opts.currency ?? "EUR"), {
    style: "percent",
    minimumFractionDigits: opts.digits ?? 1,
    maximumFractionDigits: opts.digits ?? 1,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(ratio);
}

/** ROAS / POAS / MER: 2.4137 → "2.41×". */
export function formatMultiple(ratio: Ratio | undefined, currency = "EUR"): string {
  if (ratio === null || ratio === undefined) return EMPTY_VALUE;
  return `${new Intl.NumberFormat(localeFor(currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(ratio)}×`;
}

export function formatInteger(value: number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  return new Intl.NumberFormat(localeFor(currency)).format(value);
}

export function formatBpsAsPercent(bps: number, currency = "EUR"): string {
  return formatPercent(bps / 10_000, { digits: bps % 100 === 0 ? 0 : 2, currency });
}
