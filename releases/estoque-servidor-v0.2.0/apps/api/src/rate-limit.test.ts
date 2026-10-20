import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { ipRateLimit } from "./rate-limit.js";

describe("ipRateLimit", () => {
  it("returns 429 and Retry-After after the configured number of requests", async () => {
    const app = express();
    app.get("/limited", ipRateLimit(60_000, 2), (_request, response) => response.sendStatus(204));
    expect((await request(app).get("/limited")).status).toBe(204);
    expect((await request(app).get("/limited")).status).toBe(204);
    const limited = await request(app).get("/limited");
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });
});
