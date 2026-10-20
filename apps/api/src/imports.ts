import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import multer from "multer";
import type { Response, Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "./database.js";
import { createQrToken } from "./identifiers.js";
import { requireAdmin, requireAuthentication, type AuthenticatedUser } from "./http-auth.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

const mappingSchema = z.object({
  internalCode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  referenceQuantity: z.string().optional(),
  barcode: z.string().optional()
});

const units = new Set(["UN", "CX", "MT", "ROLO"]);
type ImportRow = {
  line: number;
  internalCode: string;
  name: string;
  category: string;
  unit: string;
  referenceQuantity: string | null;
  barcode: string | null;
  errors: string[];
};

function currentUser(response: Response) {
  return response.locals.user as AuthenticatedUser;
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  return String(value).trim();
}

function parseCsv(buffer: Buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

async function readRows(file: Express.Multer.File) {
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (extension === "csv") {
    return parseCsv(file.buffer);
  }
  if (extension !== "xlsx") {
    throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  }
  const workbook = new ExcelJS.Workbook();
  // ExcelJS ainda declara um Buffer legado incompatível com os tipos atuais do Node.
  const workbookBuffer = Buffer.from(file.buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("EMPTY_IMPORT_FILE");
  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1).map(cellText) : [];
    rows.push(values);
  });
  return rows;
}

function validateRows(rawRows: string[][], mapping: z.infer<typeof mappingSchema>): ImportRow[] {
  const headers = rawRows[0]?.map((header) => header.trim()) ?? [];
  const indexOf = (column: string) => headers.indexOf(column);
  const fields = ["internalCode", "name", "category", "unit"] as const;
  const indexes: Record<(typeof fields)[number], number> = {
    internalCode: indexOf(mapping.internalCode),
    name: indexOf(mapping.name),
    category: indexOf(mapping.category),
    unit: indexOf(mapping.unit)
  };
  const optionalIndexes = {
    referenceQuantity: mapping.referenceQuantity ? indexOf(mapping.referenceQuantity) : -1,
    barcode: mapping.barcode ? indexOf(mapping.barcode) : -1
  };
  const seenCodes = new Set<string>();
  return rawRows.slice(1).map((values, offset) => {
    const row: ImportRow = {
      line: offset + 2,
      internalCode: indexes.internalCode >= 0 ? (values[indexes.internalCode] ?? "").trim() : "",
      name: indexes.name >= 0 ? (values[indexes.name] ?? "").trim() : "",
      category: indexes.category >= 0 ? (values[indexes.category] ?? "").trim() : "",
      unit: indexes.unit >= 0 ? (values[indexes.unit] ?? "").trim().toUpperCase() : "",
      referenceQuantity: optionalIndexes.referenceQuantity >= 0 ? (values[optionalIndexes.referenceQuantity] ?? "").trim() || null : null,
      barcode: optionalIndexes.barcode >= 0 ? (values[optionalIndexes.barcode] ?? "").trim() || null : null,
      errors: []
    };
    if (!row.internalCode) row.errors.push("codigo interno obrigatorio");
    if (!row.name) row.errors.push("nome obrigatorio");
    if (!row.category) row.errors.push("categoria obrigatoria");
    if (!units.has(row.unit)) row.errors.push("unidade invalida");
    if (row.referenceQuantity && !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(row.referenceQuantity)) {
      row.errors.push("saldo-base invalido");
    }
    if (seenCodes.has(row.internalCode)) row.errors.push("codigo interno duplicado no arquivo");
    seenCodes.add(row.internalCode);
    return row;
  });
}

function publicRow(row: ImportRow) {
  return {
    line: row.line,
    internalCode: row.internalCode,
    name: row.name,
    category: row.category,
    unit: row.unit,
    referenceQuantity: row.referenceQuantity,
    barcode: row.barcode,
    errors: row.errors
  };
}

export function registerImportRoutes(router: Router) {
  router.post("/products/import/preview", requireAuthentication, requireAdmin, upload.single("file"), async (request, response, next) => {
    try {
      const file = request.file;
      if (!file) {
        response.status(400).json({ error: { code: "FILE_REQUIRED", message: "Envie um arquivo CSV ou XLSX.", details: [] } });
        return;
      }
      const mapping = mappingSchema.parse(JSON.parse(String(request.body.mapping ?? "{}")));
      const rawRows = await readRows(file);
      if (rawRows.length < 2) {
        response.status(422).json({ error: { code: "EMPTY_IMPORT_FILE", message: "O arquivo nao possui linhas de dados.", details: [] } });
        return;
      }
      const rows = validateRows(rawRows, mapping);
      const batch = await prisma.importBatch.create({
        data: {
          createdById: currentUser(response).id,
          fileHash: createHash("sha256").update(file.buffer).digest("hex"),
          mapping,
          rows: rows.map(publicRow),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        },
        select: { id: true, fileHash: true, expiresAt: true }
      });
      response.status(201).json({
        batchId: batch.id,
        fileHash: batch.fileHash,
        expiresAt: batch.expiresAt.toISOString(),
        total: rows.length,
        valid: rows.filter((row) => row.errors.length === 0).length,
        invalid: rows.filter((row) => row.errors.length > 0).length,
        rows: rows.map(publicRow)
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNSUPPORTED_IMPORT_FORMAT") {
        response.status(415).json({ error: { code: "UNSUPPORTED_IMPORT_FORMAT", message: "Formato nao suportado. Use CSV ou XLSX.", details: [] } });
        return;
      }
      next(error);
    }
  });

  router.post("/products/import/confirm", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const input = z.object({ batchId: z.string().uuid(), fileHash: z.string().length(64) }).parse(request.body);
      const batch = await prisma.importBatch.findUnique({ where: { id: input.batchId } });
      if (!batch || batch.status !== "PREVIEW" || batch.expiresAt < new Date()) {
        response.status(409).json({ error: { code: "IMPORT_PREVIEW_EXPIRED", message: "A previa nao existe ou expirou.", details: [] } });
        return;
      }
      if (batch.fileHash !== input.fileHash) {
        response.status(409).json({ error: { code: "IMPORT_FILE_CHANGED", message: "O arquivo/dados nao correspondem a previa validada.", details: [] } });
        return;
      }
      const rows = z.array(z.object({
        line: z.number(),
        internalCode: z.string(),
        name: z.string(),
        category: z.string(),
        unit: z.string(),
        referenceQuantity: z.string().nullable(),
        barcode: z.string().nullable(),
        errors: z.array(z.string())
      })).parse(batch.rows);
      const invalid = rows.filter((row) => row.errors.length > 0);
      if (invalid.length > 0) {
        response.status(422).json({ error: { code: "IMPORT_HAS_ERRORS", message: "Corrija os erros antes de confirmar.", details: invalid.map(publicRow) } });
        return;
      }
      const result = await prisma.$transaction(async (transaction) => {
        let created = 0;
        let updated = 0;
        for (const row of rows) {
          const category = await transaction.category.findUnique({ where: { name: row.category } });
          if (!category || !category.active) throw new Error(`CATEGORY_NOT_FOUND:${row.line}`);
          const existing = await transaction.product.findUnique({ where: { internalCode: row.internalCode } });
          const product = existing
            ? await transaction.product.update({
              where: { id: existing.id },
              data: { name: row.name, unit: row.unit, categoryId: category.id, active: true }
            })
            : await transaction.product.create({
              data: { internalCode: row.internalCode, name: row.name, unit: row.unit, categoryId: category.id }
            });
          if (!existing) {
            await transaction.identifier.create({
              data: { productId: product.id, type: "QR", normalizedValue: createQrToken() }
            });
          }
          if (existing) updated += 1; else created += 1;
          if (row.barcode) {
            const identifier = await transaction.identifier.findFirst({ where: { normalizedValue: row.barcode, active: true } });
            if (identifier && identifier.productId !== product.id) throw new Error(`DUPLICATE_IDENTIFIER:${row.line}`);
            if (!identifier) {
              await transaction.identifier.create({ data: { productId: product.id, type: "BARCODE", normalizedValue: row.barcode } });
            }
          }
        }
        await transaction.importBatch.update({
          where: { id: batch.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() }
        });
        await transaction.audit.create({
          data: {
            userId: currentUser(response).id,
            action: "PRODUCT_IMPORT_CONFIRMED",
            objectType: "IMPORT_BATCH",
            objectId: batch.id,
            metadata: { created, updated, total: rows.length }
          }
        });
        return { created, updated, total: rows.length };
      });
      response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("CATEGORY_NOT_FOUND:")) {
        response.status(422).json({ error: { code: "CATEGORY_NOT_FOUND", message: `Categoria nao encontrada na linha ${message.split(":")[1]}.`, details: [] } });
        return;
      }
      if (message.startsWith("DUPLICATE_IDENTIFIER:")) {
        response.status(409).json({ error: { code: "DUPLICATE_IDENTIFIER", message: `Identificador duplicado na linha ${message.split(":")[1]}.`, details: [] } });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        response.status(409).json({ error: { code: "IMPORT_CONFLICT", message: "Conflito de unicidade durante a importacao.", details: [] } });
        return;
      }
      next(error);
    }
  });
}
