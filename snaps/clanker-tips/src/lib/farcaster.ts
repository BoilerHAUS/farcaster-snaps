export type ResolvedRecipient = {
  fid: number;
  username: string;
};

const HUB_API = "https://hub-api.neynar.com/v1";
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
      `${HUB_API}/userNameProofByName?name=${encodeURIComponent(username)}`,
      { signal: controller.signal }
    );

    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as { fid?: unknown; name?: unknown };
    if (typeof data.fid !== "number") return null;

    return { fid: data.fid, username: username };
  } catch {
    return null;
  }
}
