import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("API", () => {
  it("reports health without exposing secrets", async () => {
    const { app } = createApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "estoque-api" });
    expect(response.body).not.toHaveProperty("databaseUrl");
  });
});
