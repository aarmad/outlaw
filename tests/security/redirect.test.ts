import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it("allows relative paths", () => {
    expect(safeRedirectPath("/products?x=1")).toBe("/products?x=1");
  });
  it("blocks absolute and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
  });
  it("falls back when empty", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});
