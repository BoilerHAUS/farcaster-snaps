import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveRecipient } from "../../src/lib/farcaster.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockWarpcastResponse = (fid: number, username: string) =>
  new Response(
    JSON.stringify({ result: { user: { fid, username } } }),
    { status: 200 }
  );

const mockHubProfileResponse = (
  username: string,
  displayName: string,
  pfpUrl: string
) =>
  new Response(
    JSON.stringify({
      messages: [
        {
          data: {
            type: "MESSAGE_TYPE_USER_DATA_ADD",
            fid: 12345,
            timestamp: 78441221,
            network: "FARCASTER_NETWORK_MAINNET",
            userDataBody: { type: "USER_DATA_TYPE_USERNAME", value: username },
          },
          hash: "0xabc",
          hashScheme: "HASH_SCHEME_BLAKE3",
          signature: "sig==",
          signatureScheme: "SIGNATURE_SCHEME_ED25519",
          signer: "0xsigner",
        },
        {
          data: {
            type: "MESSAGE_TYPE_USER_DATA_ADD",
            fid: 12345,
            timestamp: 78441222,
            network: "FARCASTER_NETWORK_MAINNET",
            userDataBody: { type: "USER_DATA_TYPE_DISPLAY", value: displayName },
          },
          hash: "0xabc2",
          hashScheme: "HASH_SCHEME_BLAKE3",
          signature: "sig==",
          signatureScheme: "SIGNATURE_SCHEME_ED25519",
          signer: "0xsigner",
        },
        {
          data: {
            type: "MESSAGE_TYPE_USER_DATA_ADD",
            fid: 12345,
            timestamp: 78441223,
            network: "FARCASTER_NETWORK_MAINNET",
            userDataBody: { type: "USER_DATA_TYPE_PFP", value: pfpUrl },
          },
          hash: "0xabc3",
          hashScheme: "HASH_SCHEME_BLAKE3",
          signature: "sig==",
          signatureScheme: "SIGNATURE_SCHEME_ED25519",
          signer: "0xsigner",
        },
      ],
      nextPageToken: "",
    }),
    { status: 200 }
  );

const mockHubEmpty = () =>
  new Response(
    JSON.stringify({ messages: [], nextPageToken: "" }),
    { status: 200 }
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveRecipient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a pure FID number string via Hub (no Warpcast call)", async () => {
    // FID path: one Hub call for userDataByFid
    vi.mocked(fetch).mockResolvedValueOnce(
      mockHubProfileResponse("boiler", "Boiler(Chris)", "https://example.com/pfp.jpg")
    );

    const result = await resolveRecipient("14217");

    expect(result?.fid).toBe(14217);
    expect(result?.username).toBe("boiler");
    expect(result?.displayName).toBe("Boiler(Chris)");
    expect(result?.pfpUrl).toBe("https://example.com/pfp.jpg");

    // Only one fetch — to the Hub, not Warpcast
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("haatz.quilibrium.com");
  });

  it("falls back to FID as username when Hub returns empty", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockHubEmpty());

    const result = await resolveRecipient("14217");

    expect(result?.fid).toBe(14217);
    expect(result?.username).toBe("14217");
    expect(result?.displayName).toBeUndefined();
  });

  it("resolves a username via Warpcast then enriches with Hub", async () => {
    // First call: Warpcast username lookup
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));
    // Second call: Hub profile enrichment
    vi.mocked(fetch).mockResolvedValueOnce(
      mockHubProfileResponse("alice", "Alice Smith", "https://example.com/alice.jpg")
    );

    const result = await resolveRecipient("alice");

    expect(result?.fid).toBe(12345);
    expect(result?.username).toBe("alice");
    expect(result?.displayName).toBe("Alice Smith");
    expect(result?.pfpUrl).toBe("https://example.com/alice.jpg");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("strips leading @ before Warpcast lookup", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));
    vi.mocked(fetch).mockResolvedValueOnce(mockHubEmpty());

    await resolveRecipient("@alice");

    const warpcastUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(warpcastUrl).toContain("username=alice");
    expect(warpcastUrl).not.toContain("username=%40alice");
  });

  it("calls the Warpcast API endpoint for username lookup", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));
    vi.mocked(fetch).mockResolvedValueOnce(mockHubEmpty());

    await resolveRecipient("alice");

    const warpcastUrl = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(warpcastUrl).toContain("api.warpcast.com/v2/user-by-username");
  });

  it("returns null when Warpcast user is not found (404)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errors: [{ message: "No FID associated with username nobody" }] }),
        { status: 404 }
      )
    );

    const result = await resolveRecipient("nobody");
    expect(result).toBeNull();
  });

  it("returns null on Warpcast network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    const result = await resolveRecipient("alice");
    expect(result).toBeNull();
  });

  it("returns null when fid is missing from Warpcast response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { user: {} } }), { status: 200 })
    );

    const result = await resolveRecipient("alice");
    expect(result).toBeNull();
  });

  it("treats zero-padded numeric strings as usernames (not FIDs)", async () => {
    // "007" has a leading zero — not a valid FID, look up as username
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(7, "007"));
    vi.mocked(fetch).mockResolvedValueOnce(mockHubEmpty());

    const result = await resolveRecipient("007");
    expect(result?.fid).toBe(7);
  });

  it("still returns a result when Hub enrichment fails (Hub 404)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockWarpcastResponse(12345, "alice"));
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Not Found", { status: 404 })
    );

    const result = await resolveRecipient("alice");

    expect(result?.fid).toBe(12345);
    expect(result?.username).toBe("alice");
    // Hub failed, so no enrichment — that's fine
    expect(result?.displayName).toBeUndefined();
  });
});
