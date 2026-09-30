/**
 * Minimal in-memory token-bucket rate limiter for publish-sensitive
 * endpoints. PoC-level: state is per-process and resets on restart.
 * Production recommendation (docs/production-readiness-audit.md): replace
 * with a shared limiter (Redis/Upstash) so it works across multiple
 * instances, and add IP + actor-id keying behind a real reverse proxy.
 */
const buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

export function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: maxPerMinute, lastRefillMs: now };
  const elapsedMinutes = (now - bucket.lastRefillMs) / 60_000;
  const refill = elapsedMinutes * maxPerMinute;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + refill);
  bucket.lastRefillMs = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
