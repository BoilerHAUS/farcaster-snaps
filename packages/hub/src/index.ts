/**
 * @farcaster-snaps/hub
 *
 * Free, no-auth Farcaster Hub v1 API client.
 * Public node: https://haatz.quilibrium.com
 *
 * Use this for any FID-keyed lookups: user profiles, wallet addresses,
 * casts. No API key required — ideal for snap development.
 *
 * What this covers:
 *   getUserProfile(fid)    → username, displayName, pfpUrl, bio
 *   getWalletAddresses(fid) → connected ETH + SOL addresses
 *   getCasts(fid, limit?)  → recent casts
 *   getCast(fid, hash)     → a specific cast
 *
 * What this does NOT cover:
 *   username → FID resolution  (use Warpcast API: api.warpcast.com/v2/user-by-username)
 *   text search, trending, engagement counts  (use Neynar when needed)
 */

import {
  toUserProfile,
  toWalletAddresses,
  toCast,
  isMessagesResponse,
  isHubMessage,
} from "./transform.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type UserProfile = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
};

export type WalletAddresses = {
  /** Lowercase hex Ethereum addresses. */
  eth: string[];
  /** Solana addresses (base58). */
  sol: string[];
};

export type Cast = {
  fid: number;
  hash: string;
  timestamp: Date;
  text: string;
  embeds: string[];
  parentFid?: number;
  parentHash?: string;
  parentUrl?: string;
  mentions: number[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const HUB_BASE_URL = "https://haatz.quilibrium.com";
const FETCH_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function hubGet(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${HUB_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a user's profile fields from the Hub.
 * Returns null if the FID doesn't exist or the request fails.
 */
export async function getUserProfile(fid: number): Promise<UserProfile | null> {
  const data = await hubGet(`/v1/userDataByFid?fid=${fid}`);
  if (!isMessagesResponse(data)) return null;
  return toUserProfile(fid, data.messages);
}

/**
 * Fetch all verified wallet addresses for a FID.
 * Returns { eth: [], sol: [] } on failure — never throws.
 */
export async function getWalletAddresses(fid: number): Promise<WalletAddresses> {
  const data = await hubGet(`/v1/verificationsByFid?fid=${fid}`);
  if (!isMessagesResponse(data)) return { eth: [], sol: [] };
  return toWalletAddresses(data.messages);
}

/**
 * Fetch a user's recent casts. Skips CAST_REMOVE messages.
 * Returns [] on failure — never throws.
 */
export async function getCasts(fid: number, limit = 10): Promise<Cast[]> {
  const data = await hubGet(`/v1/castsByFid?fid=${fid}&pageSize=${limit}`);
  if (!isMessagesResponse(data)) return [];

  return data.messages.flatMap((msg) => {
    const cast = toCast(msg);
    return cast !== null ? [cast] : [];
  });
}

/**
 * Fetch a specific cast by FID + hash.
 * Returns null if not found or request fails.
 */
export async function getCast(fid: number, hash: string): Promise<Cast | null> {
  const data = await hubGet(`/v1/castById?fid=${fid}&hash=${encodeURIComponent(hash)}`);
  if (!isHubMessage(data)) return null;
  return toCast(data);
}
