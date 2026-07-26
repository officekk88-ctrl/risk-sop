export function isSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const allowed = new Set([requestUrl.origin]);
    if (process.env.APP_ORIGIN) allowed.add(new URL(process.env.APP_ORIGIN).origin);

    // Next.js may expose the bind address (for example 0.0.0.0) in request.url.
    // Reconstruct the browser-facing origin from proxy/Host headers so localhost,
    // 127.0.0.1 and LAN access are checked against the address actually requested.
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().replace(/:$/, "");
    const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "");
    if (host && (protocol === "http" || protocol === "https")) allowed.add(`${protocol}://${host}`);

    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
