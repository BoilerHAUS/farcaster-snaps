import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStakedBalance, formatEggs, shortAddr } from "../src/lib/contract.js";

// ─── formatEggs ───────────────────────────────────────────────────────────────

describe("formatEggs", () => {
  it("returns '0' for zero", () => {
    expect(formatEggs(0n)).toBe("0");
  });

  it("formats whole numbers", () => {
    expect(formatEggs(1_000n * 10n ** 18n)).toBe("1000");
  });

  it("formats with decimals", () => {
    expect(formatEggs(1_500n * 10n ** 15n)).toBe("1.5");
  });

  it("trims trailing zeros in fraction", () => {
    expect(formatEggs(1n * 10n ** 18n + 5n * 10n ** 17n)).toBe("1.5");
  });

  it("handles small sub-whole amounts", () => {
    const half = 5n * 10n ** 17n;
    const result = formatEggs(half);
    expect(result).toMatch(/^0\.\d+$/);
  });
});

// ─── shortAddr ────────────────────────────────────────────────────────────────

describe("shortAddr", () => {
  it("shortens a full address", () => {
    expect(shortAddr("0x712f43B21cf3e1B189c27678C0f551c08c01D150")).toBe(
      "0x712f...D150"
    );
  });

  it("preserves case", () => {
    const addr = "0xAbCd1234567890AbCd1234567890AbCd12345678";
    const result = shortAddr(addr);
    expect(result).toBe("0xAbCd...5678");
  });
});

// ─── getStakedBalance ─────────────────────────────────────────────────────────

describe("getStakedBalance", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the staked balance from the RPC result", async () => {
    const wei = 1_234n * 10n ** 18n;
    const hex = "0x" + wei.toString(16).padStart(64, "0");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ result: hex }),
      })
    );

    const balance = await getStakedBalance(
      "0x712f43B21cf3e1B189c27678C0f551c08c01D150"
    );
    expect(balance).toBe(wei);
  });

  it("returns 0n when result is '0x'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ result: "0x" }),
      })
    );

    const balance = await getStakedBalance("0xdeadbeef");
    expect(balance).toBe(0n);
  });

  it("returns 0n on fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const balance = await getStakedBalance("0xdeadbeef");
    expect(balance).toBe(0n);
  });

  it("calls the correct RPC method and contract", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ result: "0x" + "0".repeat(64) }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getStakedBalance("0x1234567890123456789012345678901234567890");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://mainnet.base.org");

    const body = JSON.parse(init.body as string) as {
      method: string;
      params: [{ to: string; data: string }];
    };
    expect(body.method).toBe("eth_call");
    expect(body.params[0].to).toBe(
      "0x712f43B21cf3e1B189c27678C0f551c08c01D150"
    );
    // data starts with the 4-byte selector
    expect(body.params[0].data).toMatch(/^0x[0-9a-f]{8}/);
  });
});
