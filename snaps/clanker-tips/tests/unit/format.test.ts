import { describe, it, expect } from "vitest";
import { formatMarketCap, isValidAmount, formatAmount } from "../../src/lib/format.js";

describe("formatMarketCap", () => {
  it("formats values under 1000 as dollars", () => {
    expect(formatMarketCap(500)).toBe("$500");
    expect(formatMarketCap(0)).toBe("$0");
    expect(formatMarketCap(999)).toBe("$999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatMarketCap(1000)).toBe("$1.0K");
    expect(formatMarketCap(50000)).toBe("$50.0K");
    expect(formatMarketCap(999999)).toBe("$1000.0K");
  });

  it("formats millions with M suffix", () => {
    expect(formatMarketCap(1_000_000)).toBe("$1.0M");
    expect(formatMarketCap(1_500_000)).toBe("$1.5M");
    expect(formatMarketCap(999_000_000)).toBe("$999.0M");
  });

  it("formats billions with B suffix", () => {
    expect(formatMarketCap(1_000_000_000)).toBe("$1.0B");
    expect(formatMarketCap(2_500_000_000)).toBe("$2.5B");
  });

  it("handles null/undefined gracefully", () => {
    expect(formatMarketCap(null as unknown as number)).toBe("$?");
    expect(formatMarketCap(undefined as unknown as number)).toBe("$?");
  });
});

describe("isValidAmount", () => {
  it("accepts positive integers", () => {
    expect(isValidAmount("1")).toBe(true);
    expect(isValidAmount("100")).toBe(true);
    expect(isValidAmount("999999")).toBe(true);
  });

  it("accepts positive decimals", () => {
    expect(isValidAmount("1.5")).toBe(true);
    expect(isValidAmount("100.00")).toBe(true);
  });

  it("rejects zero and negative values", () => {
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("-5")).toBe(false);
    expect(isValidAmount("-100")).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("12abc")).toBe(false);
  });

  it("rejects whitespace-only strings", () => {
    expect(isValidAmount("   ")).toBe(false);
  });
});

describe("formatAmount", () => {
  it("trims whitespace", () => {
    expect(formatAmount("  100  ")).toBe("100");
  });

  it("returns the string as-is for valid numbers", () => {
    expect(formatAmount("500")).toBe("500");
    expect(formatAmount("1.5")).toBe("1.5");
  });

  it("strips trailing zeros after decimal", () => {
    expect(formatAmount("100.00")).toBe("100");
    expect(formatAmount("1.50")).toBe("1.5");
  });
});
