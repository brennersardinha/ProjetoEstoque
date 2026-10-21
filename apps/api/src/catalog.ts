import type { NextFunction, Request, Response, Router } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import QRCode from "qrcode";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "./database.js";
import { createQrToken, identifierValueSchema, normalizeIdentifier, resolveIdentifier } from "./identifiers.js";
import { requireAdmin, requireAuthentication } from "./http-auth.js";
import { ipRateLimit } from "./rate-limit.js";

const unitSchema = z.enum(["UN", "CX", "MT", "ROLO"]);
const idSchema = z.string().uuid();
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const photoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads/products");

function photoExtension(file: Express.Multer.File) {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ".jpg";
  if (file.mimetype === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (file.mimetype === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return ".webp";
  return null;
}

function handleDatabaseError(error: unknown, response: Response, next: NextFunction) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    response.status(409).json({
      error: { code: "DUPLICATE_RESOURCE", message: "O recurso informado ja existe.", details: [] }
    });
    return;
  }
  next(error);
}

export function registerCatalogRoutes(router: Router) {
  router.get("/categories", requireAuthentication, async (_request, response, next) => {
    try {
      const categories = await prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      });
      response.json({ data: categories });
    } catch (error) {
      next(error);
    }
  });

  router.post("/categories", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const input = z.object({ name: z.string().trim().min(1).max(120) }).parse(request.body);
      const category = await prisma.category.create({ data: { name: input.name } });
      response.status(201).json(category);
    } catch (error) {
      handleDatabaseError(error, response, next);
    }
  });

  router.get("/products", requireAuthentication, async (request, response, next) => {
    try {
      const query = z.object({
        q: z.string().trim().max(120).optional(),
        categoryId: idSchema.optional(),
        offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(50)
      }).parse(request.query);
      const products = await prisma.product.findMany({
        where: {
          active: true,
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.q ? {
            OR: [
              { internalCode: { contains: query.q, mode: "insensitive" } },
              { name: { contains: query.q, mode: "insensitive" } }
            ]
          } : {})
        },
        take: query.limit,
        skip: query.offset,
        orderBy: { name: "asc" },
        select: {
          id: true, internalCode: true, name: true, unit: true, photoUrl: true,
          category: { select: { id: true, name: true } },
          identifiers: { where: { active: true }, select: { type: true, normalizedValue: true } }
        }
      });
      response.json({ data: products });
    } catch (error) {
      next(error);
    }
  });

  router.post("/products", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const input = z.object({
        internalCode: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(200),
        unit: unitSchema,
        categoryId: idSchema
      }).parse(request.body);
      const product = await prisma.$transaction(async (transaction) => {
        const created = await transaction.product.create({
          data: input,
          select: {
            id: true, internalCode: true, name: true, unit: true, photoUrl: true,
            category: { select: { id: true, name: true } }
          }
        });
        const identifier = await transaction.identifier.create({
          data: { productId: created.id, type: "QR", normalizedValue: createQrToken() }
        });
        await transaction.audit.create({ data: { userId: response.locals.user.id, action: "QR_GENERATED", objectType: "PRODUCT", objectId: created.id, metadata: { identifierId: identifier.id, source: "PRODUCT_CREATED" } } });
        return created;
      });
      response.status(201).json(product);
    } catch (error) {
      handleDatabaseError(error, response, next);
    }
  });

  router.patch("/products/:id", ipRateLimit(15 * 60 * 1000, 10), requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const input = z.object({
        currentPassword: z.string().min(1).max(200),
        internalCode: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(200),
        unit: unitSchema,
        categoryId: idSchema,
        barcode: z.string().trim().max(255).default("")
      }).parse(request.body);
      const actor = response.locals.user;
      const admin = await prisma.user.findFirst({
        where: { id: actor.id, role: "ADMIN", active: true },
        select: { passwordHash: true }
      });
      if (!admin || !(await bcrypt.compare(input.currentPassword, admin.passwordHash))) {
        response.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "A senha do administrador está incorreta.", details: [] } });
        return;
      }

      const updated = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.product.findFirst({
          where: { id: productId, active: true },
          select: { id: true, internalCode: true, name: true, unit: true, categoryId: true }
        });
        if (!existing) throw new Error("PRODUCT_NOT_FOUND");
        const category = await transaction.category.findFirst({ where: { id: input.categoryId, active: true }, select: { id: true } });
        if (!category) throw new Error("CATEGORY_NOT_FOUND");

        const activeBarcodes = await transaction.identifier.findMany({
          where: { productId, type: "BARCODE", active: true },
          select: { normalizedValue: true }
        });
        const barcodeChanged = (activeBarcodes[0]?.normalizedValue ?? "") !== input.barcode;
        await transaction.product.update({
          where: { id: productId },
          data: { internalCode: input.internalCode, name: input.name, unit: input.unit, categoryId: input.categoryId },
        });
        if (barcodeChanged) {
          await transaction.identifier.updateMany({
            where: { productId, type: "BARCODE", active: true },
            data: { active: false, revokedAt: new Date() }
          });
          if (input.barcode) {
            await transaction.identifier.create({ data: { productId, type: "BARCODE", normalizedValue: normalizeIdentifier(input.barcode) } });
          }
        }
        await transaction.audit.create({
          data: {
            userId: actor.id,
            action: "PRODUCT_UPDATED",
            objectType: "PRODUCT",
            objectId: productId,
            metadata: {
              before: { internalCode: existing.internalCode, name: existing.name, unit: existing.unit, categoryId: existing.categoryId },
              after: { internalCode: input.internalCode, name: input.name, unit: input.unit, categoryId: input.categoryId, barcodeChanged }
            }
          }
        });
        return transaction.product.findUniqueOrThrow({
          where: { id: productId },
          select: {
            id: true, internalCode: true, name: true, unit: true, photoUrl: true,
            category: { select: { id: true, name: true } },
            identifiers: { where: { active: true }, select: { type: true, normalizedValue: true } }
          }
        });
      });
      response.json(updated);
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
        response.status(404).json({ error: { code: error.message, message: "Produto não encontrado.", details: [] } });
        return;
      }
      if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
        response.status(422).json({ error: { code: error.message, message: "Selecione uma categoria ativa.", details: [] } });
        return;
      }
      handleDatabaseError(error, response, next);
    }
  });

  router.delete("/products/:id", ipRateLimit(15 * 60 * 1000, 10), requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const { currentPassword } = z.object({ currentPassword: z.string().min(1).max(200) }).parse(request.body);
      const actor = response.locals.user;
      const admin = await prisma.user.findFirst({
        where: { id: actor.id, role: "ADMIN", active: true },
        select: { passwordHash: true }
      });
      if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
        response.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "A senha do administrador está incorreta.", details: [] } });
        return;
      }

      await prisma.$transaction(async (transaction) => {
        const product = await transaction.product.findFirst({
          where: { id: productId, active: true },
          select: { id: true, internalCode: true, name: true }
        });
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
        const pendingBalanceItem = await transaction.balanceItem.findFirst({
          where: { productId, balance: { status: { in: ["RASCUNHO", "ABERTO", "EM_REVISAO"] } } },
          select: { id: true }
        });
        if (pendingBalanceItem) throw new Error("PRODUCT_IN_ACTIVE_BALANCE");
        await transaction.product.update({ where: { id: productId }, data: { active: false } });
        await transaction.identifier.updateMany({
          where: { productId, active: true },
          data: { active: false, revokedAt: new Date() }
        });
        await transaction.audit.create({
          data: {
            userId: actor.id,
            action: "PRODUCT_DELETED",
            objectType: "PRODUCT",
            objectId: productId,
            metadata: { internalCode: product.internalCode, name: product.name }
          }
        });
      });
      response.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
        response.status(404).json({ error: { code: error.message, message: "Produto não encontrado.", details: [] } });
        return;
      }
      if (error instanceof Error && error.message === "PRODUCT_IN_ACTIVE_BALANCE") {
        response.status(409).json({ error: { code: error.message, message: "O produto está em um balanço em andamento ou rascunho. Encerre ou cancele esse balanço antes de excluir o produto.", details: [] } });
        return;
      }
      next(error);
    }
  });

  router.post("/products/:id/photo", requireAuthentication, requireAdmin, photoUpload.single("photo"), async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const file = request.file;
      if (!file) {
        response.status(400).json({ error: { code: "PRODUCT_PHOTO_REQUIRED", message: "Selecione uma foto do produto.", details: [] } });
        return;
      }
      const extension = photoExtension(file);
      if (!extension) {
        response.status(415).json({ error: { code: "PRODUCT_PHOTO_INVALID", message: "A foto deve ser JPEG, PNG ou WebP válida.", details: [] } });
        return;
      }
      const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, photoUrl: true } });
      if (!existing) {
        response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Produto não encontrado.", details: [] } });
        return;
      }
      const fileName = `${randomUUID()}${extension}`;
      const filePath = path.join(photoDirectory, fileName);
      const photoUrl = `/uploads/products/${fileName}`;
      await mkdir(photoDirectory, { recursive: true });
      await writeFile(filePath, file.buffer, { flag: "wx" });
      try {
        const updated = await prisma.$transaction(async (transaction) => {
          const product = await transaction.product.update({
            where: { id: productId },
            data: { photoUrl },
            select: { id: true, internalCode: true, name: true, unit: true, photoUrl: true, category: { select: { id: true, name: true } } }
          });
          await transaction.audit.create({ data: { userId: response.locals.user.id, action: "PRODUCT_PHOTO_UPDATED", objectType: "PRODUCT", objectId: productId } });
          return product;
        });
        if (existing.photoUrl) await unlink(path.join(photoDirectory, path.basename(existing.photoUrl))).catch(() => undefined);
        response.json(updated);
      } catch (error) {
        await unlink(filePath).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      handleDatabaseError(error, response, next);
    }
  });

  router.post("/products/:id/identifiers", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const input = z.object({
        type: z.enum(["BARCODE", "QR"]),
        value: identifierValueSchema
      }).parse(request.body);
      const identifier = await prisma.identifier.create({
        data: {
          productId,
          type: input.type,
          normalizedValue: normalizeIdentifier(input.value)
        },
        select: { id: true, type: true, normalizedValue: true, active: true }
      });
      response.status(201).json(identifier);
    } catch (error) {
      handleDatabaseError(error, response, next);
    }
  });

  router.post("/products/:id/identifiers/qr", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const identifier = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
        await tx.identifier.updateMany({ where: { productId, type: "QR", active: true }, data: { active: false, revokedAt: new Date() } });
        const created = await tx.identifier.create({
          data: { productId, type: "QR", normalizedValue: createQrToken() },
          select: { id: true, type: true, normalizedValue: true, active: true }
        });
        await tx.audit.create({ data: { userId: response.locals.user.id, action: "QR_REGENERATED", objectType: "PRODUCT", objectId: productId, metadata: { identifierId: created.id } } });
        return created;
      });
      response.status(201).json(identifier);
    } catch (error) {
      handleDatabaseError(error, response, next);
    }
  });

  router.get("/products/:id/qr-label", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const product = await prisma.product.findFirst({
        where: { id: productId, active: true },
        select: {
          id: true, internalCode: true, name: true, unit: true, photoUrl: true,
          identifiers: { where: { type: "QR", active: true }, select: { id: true, normalizedValue: true }, take: 1 }
        }
      });
      if (!product) {
        response.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Produto não encontrado.", details: [] } });
        return;
      }
      let identifier = product.identifiers[0];
      if (!identifier) {
        identifier = await prisma.identifier.create({
          data: { productId, type: "QR", normalizedValue: createQrToken() },
          select: { id: true, normalizedValue: true }
        });
        await prisma.audit.create({ data: { userId: response.locals.user.id, action: "QR_GENERATED", objectType: "PRODUCT", objectId: productId, metadata: { identifierId: identifier.id, source: "LABEL_REQUEST" } } });
      }
      const svg = await QRCode.toString(identifier.normalizedValue, { type: "svg", width: 240, margin: 1 });
      response.json({
        product: { id: product.id, internalCode: product.internalCode, name: product.name, unit: product.unit },
        identifier: { id: identifier.id, value: identifier.normalizedValue },
        svg
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/identifiers/:id", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const input = z.object({ reason: z.string().trim().max(500).optional() }).parse(request.body ?? {});
      const identifier = await prisma.$transaction(async (tx) => {
        const updated = await tx.identifier.update({
          where: { id },
          data: { active: false, revokedAt: new Date() },
          select: { id: true, productId: true, active: true, revokedAt: true }
        });
        await tx.audit.create({ data: { userId: response.locals.user.id, action: "QR_REVOKED", objectType: "PRODUCT", objectId: updated.productId, metadata: { identifierId: updated.id, reason: input.reason ?? "Revogado pelo administrador" } } });
        return updated;
      });
      response.json(identifier);
    } catch (error) {
      next(error);
    }
  });

  router.get("/products/:id/qr", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const productId = idSchema.parse(request.params.id);
      const identifier = await prisma.identifier.findFirst({ where: { productId, type: "QR", active: true, product: { active: true } }, select: { id: true, normalizedValue: true, createdAt: true } });
      if (!identifier) { response.status(404).json({ error: { code: "ACTIVE_QR_NOT_FOUND", message: "Produto sem QR ativo.", details: [] } }); return; }
      response.json({ id: identifier.id, value: identifier.normalizedValue, createdAt: identifier.createdAt.toISOString() });
    } catch (error) { next(error); }
  });

  router.get("/identifiers/resolve", requireAuthentication, async (request, response, next) => {
    try {
      const { value } = z.object({ value: identifierValueSchema }).parse(request.query);
      const identifier = await resolveIdentifier(value);
      if (!identifier) {
        response.status(404).json({
          error: { code: "IDENTIFIER_NOT_FOUND", message: "Identificador nao encontrado ou revogado.", details: [] }
        });
        return;
      }
      response.json({
        identifier: {
          id: identifier.id,
          type: identifier.type,
          value: identifier.normalizedValue
        },
        product: identifier.product
      });
    } catch (error) {
      next(error);
    }
  });
}
