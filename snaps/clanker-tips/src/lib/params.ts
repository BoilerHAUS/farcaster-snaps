/**
 * URL parameter keys used to pass state between snap screens.
 * Short names keep button target URLs compact.
 */
export const P = {
  STEP: "step",
  FID: "f",       // recipient FID
  USERNAME: "u",  // recipient username
  ADDR: "a",      // token contract address
  NAME: "n",      // token name
  SYM: "s",       // token symbol
  AMOUNT: "m",    // tip amount
} as const;

export type TipState = {
  fid: number;
  username: string;
  addr: string;
  name: string;
  sym: string;
};

/** Extract the base URL (origin + path prefix) from a snap request. */
export function snapBase(request: Request): string {
  const fromEnv = process.env.SNAP_PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const host = (forwardedHost ?? hostHeader)?.split(",")[0]?.trim();
  const isLoopback =
    host !== undefined &&
    /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/.test(host);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto
    ? forwardedProto.split(",")[0]?.trim().toLowerCase() ?? "https"
    : isLoopback
      ? "http"
      : "https";

  if (host) return `${proto}://${host}`;
  return `http://localhost:${process.env.PORT ?? "3003"}`;
}

/** Build an absolute submit target URL with tip state embedded as query params. */
export function buildTarget(
  base: string,
  step: string,
  state: TipState,
  extra?: Record<string, string>
): string {
  const p = new URLSearchParams({
    [P.STEP]: step,
    [P.FID]: String(state.fid),
    [P.USERNAME]: state.username,
    [P.ADDR]: state.addr,
    [P.NAME]: state.name,
    [P.SYM]: state.sym,
    ...extra,
  });
  return `${base}/?${p.toString()}`;
}

/** Build a simple step-only target URL. */
export function stepTarget(base: string, step: string): string {
  return `${base}/?${P.STEP}=${encodeURIComponent(step)}`;
}

/** Extract TipState from URL searchParams. Returns null if required fields missing. */
export function extractTipState(params: URLSearchParams): TipState | null {
  const fid = Number(params.get(P.FID));
  const username = params.get(P.USERNAME) ?? "";
  const addr = params.get(P.ADDR) ?? "";
  const name = params.get(P.NAME) ?? "";
  const sym = params.get(P.SYM) ?? "";

  if (!fid || !addr || !sym) return null;
  return { fid, username, addr, name, sym };
}

/** Build a CAIP-19 identifier for a Base ERC-20 token. */
export function caip19(tokenAddress: string): string {
  return `eip155:8453/erc20:${tokenAddress}`;
}
