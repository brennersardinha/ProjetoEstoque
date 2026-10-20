import { describe, expect, it } from "vitest";
import { createQrToken, normalizeIdentifier } from "./identifiers.js";

describe("identificadores para leitura", () => {
  it("remove espacos externos sem alterar zeros a esquerda", () => {
    expect(normalizeIdentifier("  000123456789  ")).toBe("000123456789");
  });

  it("gera tokens QR opacos e unicos", () => {
    const first = createQrToken();
    const second = createQrToken();
    expect(first).toMatch(/^EST-[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
  });
});
