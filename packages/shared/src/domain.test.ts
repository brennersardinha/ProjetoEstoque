import { describe, expect, it } from "vitest";
import { quantitySchema, unitSchema } from "./domain.js";

describe("regras compartilhadas", () => {
  it("aceita unidades previstas para o MVP", () => {
    expect(unitSchema.parse("UN")).toBe("UN");
    expect(unitSchema.parse("ROLO")).toBe("ROLO");
  });

  it("recusa quantidade negativa ou com mais de tres casas", () => {
    expect(quantitySchema.safeParse("-1").success).toBe(false);
    expect(quantitySchema.safeParse("1.2345").success).toBe(false);
    expect(quantitySchema.parse("12.300")).toBe("12.300");
  });
});
