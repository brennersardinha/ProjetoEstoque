import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "./database.js";

export const identifierValueSchema = z.string().trim().min(1).max(255);

export function normalizeIdentifier(value: string) {
  // Scanneres podem incluir quebra de linha; zeros a esquerda permanecem intactos.
  return identifierValueSchema.parse(value);
}

export function createQrToken() {
  return `EST-${randomBytes(18).toString("base64url")}`;
}

export async function resolveIdentifier(value: string) {
  const normalizedValue = normalizeIdentifier(value);
  return prisma.identifier.findFirst({
    where: {
      normalizedValue,
      active: true,
      product: { active: true }
    },
    select: {
      id: true,
      type: true,
      normalizedValue: true,
      product: {
        select: {
          id: true,
          internalCode: true,
          name: true,
          unit: true,
          photoUrl: true,
          category: { select: { id: true, name: true } }
        }
      }
    }
  });
}
