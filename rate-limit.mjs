import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

// The Railway HTTP edge replaces X-Real-IP with the client's remote IP.
// Do not key security-sensitive throttling on caller-controlled X-Forwarded-For.
export function clientIp(req) {
  const header = req.headers?.['x-real-ip'];
  const edgeIp = typeof header === 'string' ? header.trim() : '';
  const socketIp = req.socket?.remoteAddress || '';
  if (isIP(edgeIp)) return edgeIp;
  if (isIP(socketIp)) return socketIp;
  return 'unknown';
}

export function createRateLimiter({ limit = 6, windowMs = 600_000, maxEntries = 2_000, clock = Date.now } = {}) {
  const buckets = new Map();
  return (req) => {
    const key = createHash('sha256').update(clientIp(req)).digest('hex');
    const now = clock();
    const previous = buckets.get(key);
    if (previous && now - previous.since >= 0 && now - previous.since < windowMs) {
      previous.hits += 1;
      return previous.hits <= limit;
    }
    if (previous) buckets.delete(key);
    if (buckets.size >= maxEntries) {
      for (const [candidate, value] of buckets) {
        if (now - value.since >= windowMs || now < value.since) buckets.delete(candidate);
      }
    }
    while (buckets.size >= maxEntries) buckets.delete(buckets.keys().next().value);
    buckets.set(key, { since: now, hits: 1 });
    return true;
  };
}
