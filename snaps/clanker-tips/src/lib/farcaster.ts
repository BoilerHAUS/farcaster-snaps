export type ResolvedRecipient = {
  fid: number;
  username: string;
};

const WARPCAST_API = "https://api.warpcast.com/v2";
const FETCH_TIMEOUT_MS = 3_000;

export async function resolveRecipient(
  input: string
): Promise<ResolvedRecipient | null> {
  const trimmed = input.trim();

  // Pure integer (no leading zeros) → treat as FID directly
  if (/^[1-9]\d*$/.test(trimmed)) {
    return { fid: parseInt(trimmed, 10), username: trimmed };
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

    const data = (await res.json()) as { result?: { user?: { fid?: unknown; username?: unknown } } };
    const fid = data.result?.user?.fid;
    const resolvedUsername = data.result?.user?.username;
    if (typeof fid !== "number") return null;

    return { fid, username: typeof resolvedUsername === "string" ? resolvedUsername : username };
  } catch {
    return null;
  }
}
