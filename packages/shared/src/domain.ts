import { z } from "zod";

export const unitSchema = z.enum(["UN", "CX", "MT", "ROLO", "PAR"]);
// Produtos em PAR (solados) são contados por numeração.
export const soleSizes = [34, 35, 36, 37, 38, 39, 40] as const;
export type Unit = z.infer<typeof unitSchema>;

export const quantitySchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, "Quantidade deve ser decimal nao negativa com ate 3 casas.");

export const roleSchema = z.enum(["ADMIN", "VENDEDOR"]);
export type Role = z.infer<typeof roleSchema>;

export const balanceStatusSchema = z.enum(["RASCUNHO", "ABERTO", "EM_REVISAO", "ENCERRADO", "CANCELADO"]);
export type BalanceStatus = z.infer<typeof balanceStatusSchema>;
