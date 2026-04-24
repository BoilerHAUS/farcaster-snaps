import { keccak_256 } from "@noble/hashes/sha3";

const BASE_RPC = "https://mainnet.base.org";

export const STAKING_PROXY = "0x712f43B21cf3e1B189c27678C0f551c08c01D150";

export const BASESCAN_WRITE_URL =
  `https://basescan.org/address/${STAKING_PROXY}#writeProxyContract`;

const EGGS_DECIMALS = 18;

const STAKE_OF_SEL = (() => {
  const hash = keccak_256(new TextEncoder().encode("stakeOf(address)"));
  return Array.from(hash.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
})();

export async function getStakedBalance(address: string): Promise<bigint> {
  const addr = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const data = `0x${STAKE_OF_SEL}${addr}`;

  try {
    const res = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: STAKING_PROXY, data }, "latest"],
      }),
      signal: AbortSignal.timeout(5_000),
    });

    const json = (await res.json()) as { result?: string };
    if (!json.result || json.result === "0x") return 0n;
    return BigInt(json.result);
  } catch {
    return 0n;
  }
}

export function formatEggs(wei: bigint): string {
  if (wei === 0n) return "0";
  const d = BigInt(10 ** EGGS_DECIMALS);
  const whole = wei / d;
  const rem = wei % d;
  if (rem === 0n) return whole.toString();
  const frac = rem
    .toString()
    .padStart(EGGS_DECIMALS, "0")
    .slice(0, 4)
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
