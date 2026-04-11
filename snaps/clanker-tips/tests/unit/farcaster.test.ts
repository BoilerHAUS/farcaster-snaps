import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveRecipient } from "../../src/lib/farcaster.js";

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

  it("resolves a username via the Hub API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ fid: 12345, name: "alice", owner: "0x..." }),
        { status: 200 }
      )
    );

    const result = await resolveRecipient("alice");

    expect(result).toEqual({ fid: 12345, username: "alice" });
  });

  it("strips leading @ from username before resolving", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ fid: 12345, name: "alice", owner: "0x..." }),
        { status: 200 }
      )
    );

    const result = await resolveRecipient("@alice");

    expect(result).toEqual({ fid: 12345, username: "alice" });

    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("name=alice");
    expect(calledUrl).not.toContain("name=%40alice");
  });

  it("returns null when user is not found (404)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "not found" }), { status: 404 })
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
      new Response(JSON.stringify({ name: "alice" }), { status: 200 })
    );

    const result = await resolveRecipient("alice");
    expect(result).toBeNull();
  });

  it("handles numeric string that looks like a username (zero-padded)", async () => {
    // "007" is not a valid FID (leading zero) — treat as username
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ fid: 7, name: "007", owner: "0x..." }),
        { status: 200 }
      )
    );

    const result = await resolveRecipient("007");
    expect(result?.fid).toBe(7);
  });
});
