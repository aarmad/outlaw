import { describe, expect, it } from "vitest";
import { classifyHeadroom } from "@/lib/finance/headroom";

describe("classifyHeadroom (20 % buffer)", () => {
  it("CPA €31 vs break-even €24 → above break-even by €7", () => {
    expect(classifyHeadroom(3100, 2400, 2000)).toEqual({ status: "ABOVE_BREAK_EVEN", headroomCents: -700 });
  });
  it("CPA €19 vs break-even €20 → thin", () => {
    expect(classifyHeadroom(1900, 2000, 2000)).toEqual({ status: "THIN", headroomCents: 100 });
  });
  it("CPA €12.40 vs break-even €27.80 → healthy, €15.40 headroom", () => {
    expect(classifyHeadroom(1240, 2780, 2000)).toEqual({ status: "HEALTHY", headroomCents: 1540 });
  });
  it("exactly at the buffer edge counts as healthy", () => {
    expect(classifyHeadroom(1600, 2000, 2000).status).toBe("HEALTHY");
  });
  it("no break-even data or no CPA → NO_DATA", () => {
    expect(classifyHeadroom(1000, null, 2000).status).toBe("NO_DATA");
    expect(classifyHeadroom(null, 2000, 2000).status).toBe("NO_DATA");
  });
  it("non-positive contribution → NOT_VIABLE", () => {
    expect(classifyHeadroom(1000, -200, 2000).status).toBe("NOT_VIABLE");
  });
});
