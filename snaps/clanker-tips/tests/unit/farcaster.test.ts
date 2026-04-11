import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveRecipient } from "../../src/lib/farcaster.js";

const mockWarpcastResponse = (fid: number, username: string) =>
  new Response(
    JSON.stringify({ result: { user: { fid, username } } }),
    { status: 200 }
  );

describe("resolveRecipient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a pure FID number string directly (no API call)", async () => {
    const result = await resolveRecipient("14217");

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ fid: 14217, username: "14217" });
  });

  it("resolves a username via the Warpcast API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));

    const result = await resolveRecipient("alice");

    expect(result).toEqual({ fid: 12345, username: "alice" });
  });

  it("strips leading @ from username before resolving", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));

    const result = await resolveRecipient("@alice");

    expect(result).toEqual({ fid: 12345, username: "alice" });

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("username=alice");
    expect(calledUrl).not.toContain("username=%40alice");
  });

  it("calls the Warpcast API endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));

    await resolveRecipient("alice");

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("api.warpcast.com/v2/user-by-username");
  });

  it("returns null when user is not found (404)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ message: "No FID associated with username nobody" }] }), { status: 404 })
    );

    const result = await resolveRecipient("nobody");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const result = await resolveRecipient("alice");
    expect(result).toBeNull();
  });

  it("returns null when fid is missing from response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { user: {} } }), { status: 200 })
    );

    const result = await resolveRecipient("alice");
    expect(result).toBeNull();
  });

  it("handles numeric string that looks like a username (zero-padded)", async () => {
    // "007" is not a valid FID (leading zero) — treat as username
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(7, "007"));

    const result = await resolveRecipient("007");
    expect(result?.fid).toBe(7);
  });
});
