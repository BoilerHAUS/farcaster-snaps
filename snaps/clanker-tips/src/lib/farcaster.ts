import { getUserProfile, getWalletAddresses } from "@farcaster-snaps/hub";
export type { UserProfile, WalletAddresses } from "@farcaster-snaps/hub";

export type ResolvedRecipient = {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
};

const WARPCAST_API = "https://api.warpcast.com/v2";
const FETCH_TIMEOUT_MS = 3_000;

/**
 * Resolve a username or FID string to a { fid, username } pair.
 * Username → FID resolution requires the Warpcast API (no Hub equivalent).
 * Once a FID is known, use getUserProfile() for richer data.
 */
export async function resolveRecipient(
  input: string
): Promise<ResolvedRecipient | null> {
  const trimmed = input.trim();

  // Pure integer (no leading zeros) → treat as FID directly
  if (/^[1-9]\d*$/.test(trimmed)) {
    const fid = parseInt(trimmed, 10);
    const profile = await getUserProfile(fid);
    return {
      fid,
      username: profile?.username ?? trimmed,
      displayName: profile?.displayName,
      pfpUrl: profile?.pfpUrl,
    };
  }

  // Strip leading @ if present
  const username = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(
      `${WARPCAST_API}/user-by-username?username=${encodeURIComponent(username)}`,
      { signal: controller.signal }
    );

    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      result?: { user?: { fid?: unknown; username?: unknown } };
    };
    const fid = data.result?.user?.fid;
    const resolvedUsername = data.result?.user?.username;
    if (typeof fid !== "number") return null;

    // Enrich with Hub profile data (pfp, display name)
    const profile = await getUserProfile(fid);

    return {
      fid,
      username: typeof resolvedUsername === "string" ? resolvedUsername : username,
      displayName: profile?.displayName,
      pfpUrl: profile?.pfpUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch verified wallet addresses for a FID via the Hub.
 * Returns { eth: [], sol: [] } on failure.
 */
export { getWalletAddresses };
