import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInTz,
  daysBetweenInclusive,
  parseDateRange,
  previousPeriod,
  resolvePreset,
  zonedTimeToUtc,
} from "@/lib/dates";

describe("timezone helpers", () => {
  it("evaluates the calendar date in the workspace timezone", () => {
    const instant = new Date("2026-10-01T22:30:00Z"); // 00:30 next day in Paris (UTC+2)
    expect(dateInTz(instant, "Europe/Paris")).toBe("2026-10-02");
    expect(dateInTz(instant, "UTC")).toBe("2026-10-01");
  });

  it("converts wall-clock time to UTC, including DST", () => {
    expect(zonedTimeToUtc("2026-07-01", 10, 0, "Europe/Paris").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", 10, 0, "Europe/Paris").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("does date arithmetic across months", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetweenInclusive("2026-09-02", "2026-10-01")).toBe(30);
  });
});

describe("date ranges", () => {
  const today = "2026-10-01";

  it("resolves presets", () => {
    expect(resolvePreset("last_7_days", today)).toMatchObject({ from: "2026-09-25", to: today });
    expect(resolvePreset("this_month", today)).toMatchObject({ from: "2026-10-01", to: today });
    expect(resolvePreset("last_month", today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("computes the previous period of the same length", () => {
    const prev = previousPeriod(resolvePreset("last_7_days", today));
    expect(prev).toMatchObject({ from: "2026-09-18", to: "2026-09-24" });
  });

  it("parses custom ranges safely", () => {
    expect(parseDateRange({ range: "custom", from: "2026-09-10", to: "2026-09-01" }, today)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-10",
    });
    expect(parseDateRange({ range: "custom", from: "2026-09-10", to: "2027-01-01" }, today).to).toBe(today);
    expect(parseDateRange({ range: "drop table" }, today).preset).toBe("last_30_days");
    expect(parseDateRange({ range: "custom", from: "2026-02-30", to: today }, today).preset).toBe("last_30_days");
  });
});
