export type ClankerUser = {
  fid: number;
  username: string;
  display_name: string;
};

export type ClankerMarket = {
  priceUsd: number;
  marketCap: number;
};

export type ClankerToken = {
  id: number;
  contract_address: string;
  name: string;
  symbol: string;
  chain_id: number;
  deployed_at: string;
  pool_address: string;
  warnings: string[];
  related: {
    user?: ClankerUser;
    market?: ClankerMarket;
  };
};

const BASE_URL = "https://www.clanker.world/api";
const FETCH_TIMEOUT_MS = 5_000;

export async function searchTokens(
  query: string,
  limit = 6
): Promise<ClankerToken[]> {
  // Strip leading $ so "$DEGEN" searches the same as "DEGEN"
  const q = query.startsWith("$") ? query.slice(1) : query;

  const params = new URLSearchParams({
    q,
    chainId: "8453",
    includeMarket: "true",
    limit: String(limit),
  });

  const url = `${BASE_URL}/tokens?${params}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return [];

    const data = (await res.json()) as { data?: unknown[] };
    if (!Array.isArray(data.data)) return [];

    return data.data as ClankerToken[];
  } catch {
    return [];
  }
}
