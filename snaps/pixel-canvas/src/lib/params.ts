/** Derive the public base URL from the request, matching host.neynar.app conventions. */
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

/** Action query param values used to route GET and POST submissions. */
export const ACTION = {
  STAGE: "stage",    // preview cells in chosen color — no cooldown
  COMMIT: "commit",  // finalize staged cells, start cooldown
  PAINT: "paint",    // legacy alias for commit (backward compat)
  CANCEL: "cancel",  // clear own staged cells
  CLEAR: "clear",    // clear entire canvas (owner or when full)
  GALLERY: "gallery",
  VIEW: "view",      // return to main canvas without staging
} as const;
