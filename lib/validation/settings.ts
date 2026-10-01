import { z } from "zod";
import { parseMoneyInput, parsePercentInput } from "@/lib/finance/money";

/** "2.9" → 290 bps, bounded to [0, max %]. */
const percent = (maxPercent: number) =>
  z
    .string()
    .transform((v, ctx) => {
      const bps = parsePercentInput(v);
      if (bps === null || bps > maxPercent * 100) {
        ctx.addIssue({ code: "custom", message: `Enter a percentage between 0 and ${maxPercent}.` });
        return z.NEVER;
      }
      return bps;
    });

const money = z.string().transform((v, ctx) => {
  const cents = parseMoneyInput(v);
  if (cents === null || cents < 0 || cents > 100_000) {
    ctx.addIssue({ code: "custom", message: "Enter an amount like 0.30." });
    return z.NEVER;
  }
  return cents;
});

const priceEndings = z.string().transform((v, ctx) => {
  const parts = v
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const values = parts.map(Number);
  if (values.length === 0 || values.length > 6 || values.some((n) => !Number.isInteger(n) || n < 0 || n > 99)) {
    ctx.addIssue({ code: "custom", message: "Enter up to 6 endings between 0 and 99, e.g. 90, 95, 99." });
    return z.NEVER;
  }
  return [...new Set(values)].sort((a, b) => a - b);
});

export const financeSettingsSchema = z.object({
  paymentFeePercent: percent(20),
  paymentFixedFee: money,
  refundBufferPercent: percent(50),
  vatMode: z.enum(["NONE", "INCLUDED"]),
  vatRatePercent: percent(30),
  otherVariableCostPercent: percent(50),
  targetNetMarginPercent: percent(90),
  targetCpaBufferPercent: percent(90),
  refundRateThresholdPercent: percent(50),
  priceEndings,
});
