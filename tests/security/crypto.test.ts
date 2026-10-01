import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, safeEqual } from "@/lib/security/crypto";

const key = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  it("round-trips and never contains the plaintext", () => {
    const token = "shpat_super_secret_token";
    const enc = encryptSecret(token, key);
    expect(enc).not.toContain(token);
    expect(decryptSecret(enc, key)).toBe(token);
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("detects tampering", () => {
    const enc = encryptSecret("token", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });

  it("rejects a wrong key", () => {
    const enc = encryptSecret("token", key);
    expect(() => decryptSecret(enc, randomBytes(32).toString("base64"))).toThrow();
  });
});

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
