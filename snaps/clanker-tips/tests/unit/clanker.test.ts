import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchTokens } from "../../src/lib/clanker.js";

const mockToken = {
  id: 1,
  contract_address: "0xabc123",
  name: "Test Token",
  symbol: "TEST",
  chain_id: 8453,
  deployed_at: "2024-01-01T00:00:00Z",
  pool_address: "0xpool",
  warnings: [],
  related: {
    market: { priceUsd: 0.001, marketCap: 50000 },
  },
};

describe("searchTokens", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns token array on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [mockToken] }), { status: 200 })
    );

    const result = await searchTokens("test");

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Test Token");
    expect(result[0]?.symbol).toBe("TEST");
    expect(result[0]?.contract_address).toBe("0xabc123");
  });

  it("calls the correct Clanker API endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await searchTokens("degen");

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("https://www.clanker.world/api/tokens");
    expect(calledUrl).toContain("q=degen");
    expect(calledUrl).toContain("chainId=8453");
    expect(calledUrl).toContain("includeMarket=true");
  });

  it("strips leading $ from query before calling API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await searchTokens("$DEGEN");

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("q=DEGEN");
    expect(calledUrl).not.toContain("q=%24");
  });

  it("URL-encodes the search query", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await searchTokens("hello world");

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("q=hello+world");
  });

  it("returns empty array when data is missing from response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    const result = await searchTokens("bogus");
    expect(result).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network failure"));

    const result = await searchTokens("test");
    expect(result).toEqual([]);
  });

  it("returns empty array on non-200 status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 })
    );

    const result = await searchTokens("test");
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await searchTokens("test", 3);

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("limit=3");
  });
});
