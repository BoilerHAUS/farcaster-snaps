export type ClankerUser = {
  fid: number;
  username: string;
  display_name: string;
};

export type ClankerMarket = {
  price: number;
  market_cap: number;
};

export type ClankerToken = {
  id: number;
  contract_address: string;
  name: string;
  symbol: string;
  chain_id: number;
  deployed_at: string;
  pool_address: string;
  starting_market_cap: number;
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
  const params = new URLSearchParams({
    q: query,
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

    const data = (await res.json()) as { tokens?: unknown[] };
    if (!Array.isArray(data.tokens)) return [];

    return data.tokens as ClankerToken[];
  } catch {
    return [];
  }
}
