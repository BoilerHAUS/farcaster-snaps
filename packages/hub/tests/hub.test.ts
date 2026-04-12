import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUserProfile,
  getWalletAddresses,
  getCasts,
  getCast,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Fixtures — raw Hub v1 API shapes
// ---------------------------------------------------------------------------

const makeUserDataMsg = (type: string, value: string, fid = 14217) => ({
  data: {
    type: "MESSAGE_TYPE_USER_DATA_ADD",
    fid,
    timestamp: 78441221,
    network: "FARCASTER_NETWORK_MAINNET",
    userDataBody: { type, value },
  },
  hash: "0xabc",
  hashScheme: "HASH_SCHEME_BLAKE3",
  signature: "sig==",
  signatureScheme: "SIGNATURE_SCHEME_ED25519",
  signer: "0xsigner",
});

const makeVerificationMsg = (address: string, protocol: string, fid = 14217) => ({
  data: {
    type: "MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS",
    fid,
    timestamp: 130000000,
    network: "FARCASTER_NETWORK_MAINNET",
    verificationAddAddressBody: {
      address,
      claimSignature: "claimsig==",
      blockHash: "0xblockhash",
      type: 0,
      chainId: 0,
      protocol,
    },
  },
  hash: "0xverif",
  hashScheme: "HASH_SCHEME_BLAKE3",
  signature: "sig==",
  signatureScheme: "SIGNATURE_SCHEME_ED25519",
  signer: "0xsigner",
});

const makeCastMsg = (text: string, fid = 14217, hash = "0xcast1") => ({
  data: {
    type: "MESSAGE_TYPE_CAST_ADD",
    fid,
    timestamp: 80000000,
    network: "FARCASTER_NETWORK_MAINNET",
    castAddBody: {
      embedsDeprecated: [],
      mentions: [],
      parentCastId: null,
      parentUrl: null,
      text,
      embeds: [],
      mentionsPositions: [],
      type: "CAST",
    },
  },
  hash,
  hashScheme: "HASH_SCHEME_BLAKE3",
  signature: "sig==",
  signatureScheme: "SIGNATURE_SCHEME_ED25519",
  signer: "0xsigner",
});

const makeCastWithEmbedsMsg = (text: string, embeds: string[], fid = 14217) => ({
  ...makeCastMsg(text, fid),
  data: {
    ...makeCastMsg(text, fid).data,
    castAddBody: {
      ...makeCastMsg(text, fid).data.castAddBody,
      embeds: embeds.map((url) => ({ url })),
    },
  },
});

const makeCastWithParentMsg = (
  text: string,
  parentFid: number,
  parentHash: string,
  fid = 14217
) => ({
  ...makeCastMsg(text, fid),
  data: {
    ...makeCastMsg(text, fid).data,
    castAddBody: {
      ...makeCastMsg(text, fid).data.castAddBody,
      parentCastId: { fid: parentFid, hash: parentHash },
    },
  },
});

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

const notFoundResponse = () => new Response("Not Found", { status: 404 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getUserProfile", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns null on 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(notFoundResponse());
    expect(await getUserProfile(99999)).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect(await getUserProfile(14217)).toBeNull();
  });

  it("maps username, displayName, pfpUrl, bio from userDataByFid messages", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeUserDataMsg("USER_DATA_TYPE_USERNAME", "boiler"),
          makeUserDataMsg("USER_DATA_TYPE_DISPLAY", "Boiler(Chris)"),
          makeUserDataMsg(
            "USER_DATA_TYPE_PFP",
            "https://example.com/pfp.jpg"
          ),
          makeUserDataMsg("USER_DATA_TYPE_BIO", "Web3 nerd"),
        ],
        nextPageToken: "",
      })
    );

    const profile = await getUserProfile(14217);
    expect(profile).toEqual({
      fid: 14217,
      username: "boiler",
      displayName: "Boiler(Chris)",
      pfpUrl: "https://example.com/pfp.jpg",
      bio: "Web3 nerd",
    });
  });

  it("leaves fields undefined when messages are missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [makeUserDataMsg("USER_DATA_TYPE_USERNAME", "boiler")],
        nextPageToken: "",
      })
    );

    const profile = await getUserProfile(14217);
    expect(profile?.username).toBe("boiler");
    expect(profile?.displayName).toBeUndefined();
    expect(profile?.pfpUrl).toBeUndefined();
  });

  it("ignores unknown userDataBody types", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeUserDataMsg("USER_DATA_TYPE_LOCATION", "geo:44.18,-81.64"),
          makeUserDataMsg("USER_DATA_TYPE_USERNAME", "boiler"),
        ],
        nextPageToken: "",
      })
    );

    const profile = await getUserProfile(14217);
    expect(profile?.username).toBe("boiler");
  });

  it("calls the correct Hub endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({ messages: [], nextPageToken: "" })
    );

    await getUserProfile(14217);

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("haatz.quilibrium.com");
    expect(url).toContain("/v1/userDataByFid");
    expect(url).toContain("fid=14217");
  });
});

describe("getWalletAddresses", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns empty arrays on 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(notFoundResponse());
    expect(await getWalletAddresses(99999)).toEqual({ eth: [], sol: [] });
  });

  it("returns empty arrays on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect(await getWalletAddresses(14217)).toEqual({ eth: [], sol: [] });
  });

  it("separates ETH and SOL addresses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeVerificationMsg("0xA2216234014166BCF0B64E6D7363bBAC9Da2b75f", "PROTOCOL_ETHEREUM"),
          makeVerificationMsg("3VNP742KaJAfLAp3ABvU49CVhZFxWHueTTxHpb7R7KdH", "PROTOCOL_SOLANA"),
        ],
        nextPageToken: "",
      })
    );

    const addrs = await getWalletAddresses(14217);
    expect(addrs.eth).toEqual(["0xa2216234014166bcf0b64e6d7363bbac9da2b75f"]);
    expect(addrs.sol).toEqual(["3VNP742KaJAfLAp3ABvU49CVhZFxWHueTTxHpb7R7KdH"]);
  });

  it("normalizes ETH addresses to lowercase", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeVerificationMsg("0xABCDEF1234567890ABCDEF1234567890ABCDEF12", "PROTOCOL_ETHEREUM"),
        ],
        nextPageToken: "",
      })
    );

    const addrs = await getWalletAddresses(14217);
    expect(addrs.eth[0]).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
  });

  it("returns multiple ETH addresses when multiple verifications exist", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeVerificationMsg("0xaaaa000000000000000000000000000000000001", "PROTOCOL_ETHEREUM"),
          makeVerificationMsg("0xbbbb000000000000000000000000000000000002", "PROTOCOL_ETHEREUM"),
        ],
        nextPageToken: "",
      })
    );

    const addrs = await getWalletAddresses(14217);
    expect(addrs.eth).toHaveLength(2);
  });
});

describe("getCasts", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns empty array on 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(notFoundResponse());
    expect(await getCasts(99999)).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect(await getCasts(14217)).toEqual([]);
  });

  it("maps cast messages to Cast objects", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [makeCastMsg("Hello world", 14217, "0xcast1")],
        nextPageToken: "",
      })
    );

    const casts = await getCasts(14217);
    expect(casts).toHaveLength(1);
    expect(casts[0]?.text).toBe("Hello world");
    expect(casts[0]?.fid).toBe(14217);
    expect(casts[0]?.hash).toBe("0xcast1");
  });

  it("converts Farcaster timestamps to JS Dates", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [makeCastMsg("ts test")],
        nextPageToken: "",
      })
    );

    const casts = await getCasts(14217);
    // timestamp 80000000 + FC_EPOCH(1609459200) = 1689459200 seconds
    expect(casts[0]?.timestamp).toBeInstanceOf(Date);
    expect(casts[0]?.timestamp.getTime()).toBe((80000000 + 1609459200) * 1000);
  });

  it("skips CAST_REMOVE messages", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeCastMsg("keep this"),
          {
            data: {
              type: "MESSAGE_TYPE_CAST_REMOVE",
              fid: 14217,
              timestamp: 80000001,
              network: "FARCASTER_NETWORK_MAINNET",
              castRemoveBody: { targetHash: "abc==" },
            },
            hash: "0xremove1",
            hashScheme: "HASH_SCHEME_BLAKE3",
            signature: "sig==",
            signatureScheme: "SIGNATURE_SCHEME_ED25519",
            signer: "0xsigner",
          },
        ],
        nextPageToken: "",
      })
    );

    const casts = await getCasts(14217);
    expect(casts).toHaveLength(1);
    expect(casts[0]?.text).toBe("keep this");
  });

  it("extracts embed URLs from casts", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [
          makeCastWithEmbedsMsg("check this out", ["https://example.com/img.png"]),
        ],
        nextPageToken: "",
      })
    );

    const casts = await getCasts(14217);
    expect(casts[0]?.embeds).toEqual(["https://example.com/img.png"]);
  });

  it("includes parent cast info when present", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({
        messages: [makeCastWithParentMsg("a reply", 4167, "0xparenthash")],
        nextPageToken: "",
      })
    );

    const casts = await getCasts(14217);
    expect(casts[0]?.parentFid).toBe(4167);
    expect(casts[0]?.parentHash).toBe("0xparenthash");
  });

  it("passes pageSize to the Hub endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      okResponse({ messages: [], nextPageToken: "" })
    );

    await getCasts(14217, 25);

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("pageSize=25");
  });
});

describe("getCast", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns null on 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(notFoundResponse());
    expect(await getCast(14217, "0xbadHash")).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect(await getCast(14217, "0xhash")).toBeNull();
  });

  it("maps a single cast message to a Cast object", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okResponse(makeCastMsg("single cast", 14217, "0xhash1")));

    const cast = await getCast(14217, "0xhash1");
    expect(cast?.text).toBe("single cast");
    expect(cast?.hash).toBe("0xhash1");
  });

  it("calls the correct Hub endpoint with fid and hash", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okResponse(makeCastMsg("test", 14217, "0xhash2")));

    await getCast(14217, "0xhash2");

    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain("/v1/castById");
    expect(url).toContain("fid=14217");
    expect(url).toContain("hash=0xhash2");
  });
});
