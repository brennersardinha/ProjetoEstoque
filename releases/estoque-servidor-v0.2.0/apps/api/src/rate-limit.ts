import type { RequestHandler } from "express";

type Bucket = { startedAt: number; count: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(options: { windowMs: number; max: number; key: (request: Parameters<RequestHandler>[0]) => string }): RequestHandler {
  return (request, response, next) => {
    const now = Date.now();
    const key = options.key(request);
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= options.windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 10000) {
      for (const [oldKey, oldBucket] of buckets) {
        if (now - oldBucket.startedAt >= options.windowMs) buckets.delete(oldKey);
      }
    }
    if (bucket.count > options.max) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.startedAt + options.windowMs - now) / 1000))));
      response.status(429).json({ error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde antes de tentar novamente.", details: [] } });
      return;
    }
    next();
  };
}

export function ipRateLimit(windowMs: number, max: number): RequestHandler {
  return rateLimit({ windowMs, max, key: (request) => request.ip ?? request.socket.remoteAddress ?? "unknown" });
}
