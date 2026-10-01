/**
 * Calendar-date helpers. Business days are evaluated in the WORKSPACE timezone, so
 * "Today" in Paris is not "today" in UTC. Calendar dates are plain "YYYY-MM-DD" strings.
 */
import { z } from "zod";

export type IsoDate = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The calendar date of `instant` in `timeZone`. */
export function dateInTz(instant: Date, timeZone: string): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive number of days between two dates. */
export function daysBetweenInclusive(from: IsoDate, to: IsoDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Offset (minutes) of `timeZone` from UTC at `instant`. Paris in summer → +120. */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** UTC instant of a wall-clock time in `timeZone`. */
export function zonedTimeToUtc(date: IsoDate, hours: number, minutes: number, timeZone: string): Date {
  const guess = new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
  const first = new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60_000);
  // Re-evaluate once around DST transitions.
  return new Date(guess.getTime() - tzOffsetMinutes(first, timeZone) * 60_000);
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_14_days", label: "Last 14 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]["id"] | "custom";
export const DEFAULT_PRESET: DatePresetId = "last_30_days";

export interface DateRange {
  preset: DatePresetId;
  from: IsoDate;
  /** Inclusive. */
  to: IsoDate;
}

const presetIds = DATE_PRESETS.map((p) => p.id) as [string, ...string[]];

const rangeParamsSchema = z.object({
  range: z.enum([...presetIds, "custom"]).optional(),
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
});

export function resolvePreset(preset: Exclude<DatePresetId, "custom">, today: IsoDate): DateRange {
  switch (preset) {
    case "today":
      return { preset, from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { preset, from: y, to: y };
    }
    case "last_7_days":
      return { preset, from: addDays(today, -6), to: today };
    case "last_14_days":
      return { preset, from: addDays(today, -13), to: today };
    case "last_30_days":
      return { preset, from: addDays(today, -29), to: today };
    case "this_month":
      return { preset, from: `${today.slice(0, 7)}-01`, to: today };
    case "last_month": {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      const lastOfPrev = addDays(firstOfThisMonth, -1);
      return { preset, from: `${lastOfPrev.slice(0, 7)}-01`, to: lastOfPrev };
    }
  }
}

/** Parses `?range=…&from=…&to=…` safely; falls back to the default preset. */
export function parseDateRange(
  params: Record<string, string | string[] | undefined>,
  today: IsoDate,
): DateRange {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const parsed = rangeParamsSchema.safeParse(flat);
  const data = parsed.success ? parsed.data : {};

  if (data.range === "custom" && data.from && data.to) {
    let { from, to } = data;
    if (from > to) [from, to] = [to, from];
    if (to > today) to = today;
    // Cap custom ranges to two years to bound query cost.
    if (daysBetweenInclusive(from, to) > 731) from = addDays(to, -730);
    return { preset: "custom", from, to };
  }
  const preset = (data.range && data.range !== "custom" ? data.range : DEFAULT_PRESET) as Exclude<
    DatePresetId,
    "custom"
  >;
  return resolvePreset(preset, today);
}

/** Same-length period immediately before `range`. */
export function previousPeriod(range: DateRange): DateRange {
  const length = daysBetweenInclusive(range.from, range.to);
  const to = addDays(range.from, -1);
  return { preset: "custom", from: addDays(to, -(length - 1)), to };
}
