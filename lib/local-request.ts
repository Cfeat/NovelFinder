// Local metadata tools do not require a hosted account. Keep these endpoints
// loopback-only; they must not become unauthenticated remote scraping services.
export function isLocalRequest(request: Request) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
}
