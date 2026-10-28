import { Prisma } from "@prisma/client";
import type { Router } from "express";
import { z } from "zod";
import { prisma } from "./database.js";
import { requireAdmin, requireAuthentication, type AuthenticatedUser } from "./http-auth.js";

const idSchema = z.string().uuid();
const quantitySchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, "Quantidade deve ser decimal nao negativa com ate 3 casas.");
const balanceStatusSchema = z.enum(["RASCUNHO", "ABERTO", "EM_REVISAO", "ENCERRADO", "CANCELADO"]);

// Solados (unidade PAR) entram no balanço com um item por numeração da grade.
const GRADE_UNIT = "PAR";
const SOLE_SIZES = [34, 35, 36, 37, 38, 39, 40];

type SelectedProduct = { productId: string; referenceQuantity: string; selectedIndividually: boolean };

function expandSizeGrid(selection: SelectedProduct[], units: Map<string, string>) {
  return selection.flatMap((item) => units.get(item.productId) === GRADE_UNIT
    ? SOLE_SIZES.map((size) => ({ ...item, referenceQuantity: "0", size }))
    : [{ ...item, size: 0 }]);
}

const productSelectionSchema = z.object({
  productId: idSchema,
  referenceQuantity: quantitySchema
});

function user(response: { locals: { user?: AuthenticatedUser } }) {
  const currentUser = response.locals.user;
  if (!currentUser) {
    throw new Error("Authenticated user was not attached to request.");
  }
  return currentUser;
}

function serializeCount(count: {
  id: string;
  quantity: Prisma.Decimal;
  countedAt: Date;
  user: { id: string; name: string };
  observation: string | null;
  isRecount: boolean;
}) {
  return {
    id: count.id,
    quantity: count.quantity.toString(),
    countedAt: count.countedAt.toISOString(),
    countedBy: count.user,
    observation: count.observation,
    isRecount: count.isRecount
  };
}

export function registerBalanceRoutes(router: Router) {
  router.get("/balances", requireAuthentication, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const query = z.object({ all: z.enum(["true", "false"]).optional() }).parse(request.query);
      if (query.all === "true" && currentUser.role !== "ADMIN") {
        response.status(403).json({ error: { code: "FORBIDDEN", message: "Somente ADMIN pode consultar todos os balanços.", details: [] } });
        return;
      }
      const includeAll = currentUser.role === "ADMIN" && query.all === "true";
      const balances = await prisma.balance.findMany({
        where: includeAll ? {} : {
          status: { in: ["ABERTO", "EM_REVISAO"] },
          ...(currentUser.role === "VENDEDOR" ? { assignments: { some: { userId: currentUser.id } } } : {})
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          kind: true,
          categoryId: true,
          selectedCategories: { select: { category: { select: { id: true, name: true } } } },
          status: true,
          createdAt: true,
          openedAt: true,
          closedAt: true,
          cancelledAt: true,
          cancellationReason: true,
          createdBy: { select: { id: true, name: true, login: true } },
          assignments: { select: { user: { select: { id: true, name: true, login: true, active: true } } } },
          _count: { select: { items: true } },
          items: {
            select: {
              counts: {
                ...(currentUser.role === "VENDEDOR" ? { where: { userId: currentUser.id } } : {}),
                select: { id: true }
              }
            }
          }
        }
      });
      response.json({
        data: balances.map((balance) => ({
          id: balance.id,
          name: balance.name,
          kind: balance.kind,
          categoryId: balance.categoryId,
          selectedCategories: balance.selectedCategories.map(({ category }) => category),
          status: balance.status,
          createdAt: balance.createdAt.toISOString(),
          openedAt: balance.openedAt?.toISOString() ?? null,
          closedAt: balance.closedAt?.toISOString() ?? null,
          cancelledAt: balance.cancelledAt?.toISOString() ?? null,
          cancellationReason: balance.cancellationReason,
          createdBy: includeAll ? balance.createdBy : undefined,
          assignedSellers: includeAll ? balance.assignments.map(({ user: assignedSeller }) => assignedSeller) : undefined,
          itemCount: balance._count.items,
          myCountedItemCount: balance.items.filter((item) => item.counts.length > 0).length
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/balances/:id/report", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const balanceId = idSchema.parse(request.params.id);
      const balance = await prisma.balance.findUnique({
        where: { id: balanceId },
        select: {
          id: true, name: true, kind: true, categoryId: true, selectedCategories: { select: { category: { select: { id: true, name: true } } } }, status: true, createdAt: true, openedAt: true,
          closedAt: true, cancelledAt: true, cancellationReason: true,
          createdBy: { select: { id: true, name: true, login: true } },
          assignments: { select: { user: { select: { id: true, name: true, login: true } } } },
          items: {
            orderBy: [{ product: { category: { name: "asc" } } }, { product: { name: "asc" } }, { size: "asc" }],
            select: {
              id: true, size: true, referenceQuantity: true, finalQuantity: true, approvedCountId: true,
              approvedAt: true, status: true,
              approvedBy: { select: { id: true, name: true, login: true } },
              product: {
                select: {
                  id: true, internalCode: true, name: true, unit: true,
                  category: { select: { id: true, name: true } }
                }
              },
              counts: {
                orderBy: { countedAt: "asc" },
                select: {
                  id: true, quantity: true, countedAt: true, observation: true, isRecount: true,
                  user: { select: { id: true, name: true, login: true } }
                }
              }
            }
          }
        }
      });
      if (!balance) {
        response.status(404).json({ error: { code: "BALANCE_NOT_FOUND", message: "Balanço não encontrado.", details: [] } });
        return;
      }

      const categories = new Map<string, { id: string; name: string; items: unknown[] }>();
      for (const item of balance.items) {
        const category = item.product.category;
        const group = categories.get(category.id) ?? { id: category.id, name: category.name, items: [] };
        group.items.push({
          id: item.id,
          product: item.product,
          size: item.size || null,
          referenceQuantity: item.referenceQuantity.toString(),
          finalQuantity: (item.finalQuantity ?? (balance.status === "ENCERRADO" ? item.counts[item.counts.length - 1]?.quantity ?? null : null))?.toString() ?? null,
          status: item.status,
          approvedAt: item.approvedAt?.toISOString() ?? null,
          approvedBy: item.approvedBy,
          counts: item.counts.map((count) => ({
            id: count.id,
            quantity: count.quantity.toString(),
            countedAt: count.countedAt.toISOString(),
            countedBy: count.user,
            observation: count.observation,
            isRecount: count.isRecount,
            approved: count.id === item.approvedCountId
          }))
        });
        categories.set(category.id, group);
      }
      response.json({
        generatedAt: new Date().toISOString(),
        balance: {
          id: balance.id,
          name: balance.name,
          kind: balance.kind,
          categoryId: balance.categoryId,
          selectedCategories: balance.selectedCategories.map(({ category }) => category),
          status: balance.status,
          createdAt: balance.createdAt.toISOString(),
          openedAt: balance.openedAt?.toISOString() ?? null,
          closedAt: balance.closedAt?.toISOString() ?? null,
          cancelledAt: balance.cancelledAt?.toISOString() ?? null,
          cancellationReason: balance.cancellationReason,
          createdBy: balance.createdBy,
          assignedSellers: balance.assignments.map(({ user: assignedSeller }) => assignedSeller),
          itemCount: balance.items.length
        },
        categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/balances", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const input = z.object({
        name: z.string().trim().min(1).max(160),
        kind: z.enum(["CATEGORIA", "PERSONALIZADO"]).default("PERSONALIZADO"),
        categoryId: idSchema.optional(),
        categoryIds: z.array(idSchema).max(500).optional(),
        sellerIds: z.array(idSchema).min(1).max(500),
        items: z.array(productSelectionSchema).max(10000).default([])
      }).parse(request.body);
      const categoryIds = [...new Set(input.categoryIds ?? (input.categoryId ? [input.categoryId] : []))];
      if ((input.kind === "CATEGORIA" && (!categoryIds.length || input.items.length > 0)) || (input.kind === "PERSONALIZADO" && (input.categoryId !== undefined || (!categoryIds.length && input.items.length === 0)))) {
        response.status(400).json({ error: { code: "INVALID_BALANCE_SOURCE", message: "Selecione uma categoria ou informe produtos para o balanço personalizado.", details: [] } });
        return;
      }
      if (new Set(input.sellerIds).size !== input.sellerIds.length) {
        response.status(400).json({ error: { code: "DUPLICATE_SELLER", message: "Um vendedor nao pode ser selecionado duas vezes.", details: [] } });
        return;
      }
      if (input.categoryIds && new Set(input.categoryIds).size !== input.categoryIds.length) {
        response.status(400).json({ error: { code: "DUPLICATE_CATEGORY", message: "Uma categoria nao pode ser selecionada duas vezes.", details: [] } }); return;
      }
      if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
        response.status(400).json({ error: { code: "DUPLICATE_PRODUCT", message: "Um produto nao pode ser selecionado duas vezes.", details: [] } });
        return;
      }
      const selectedCategories = categoryIds.length ? await prisma.category.findMany({ where: { id: { in: categoryIds }, active: true }, select: { id: true } }) : [];
      if (selectedCategories.length !== categoryIds.length) { response.status(422).json({ error: { code: "CATEGORY_NOT_FOUND_OR_INACTIVE", message: "Todas as categorias devem existir e estar ativas.", details: [] } }); return; }
      const categoryProducts = categoryIds.length ? await prisma.product.findMany({ where: { categoryId: { in: categoryIds }, active: true }, select: { id: true } }) : [];
      const productMap = new Map<string, SelectedProduct>();
      if (input.kind === "CATEGORIA" || categoryIds.length) for (const product of categoryProducts) productMap.set(product.id, { productId: product.id, referenceQuantity: "0", selectedIndividually: false });
      if (input.kind === "PERSONALIZADO") for (const item of input.items) productMap.set(item.productId, { ...item, selectedIndividually: true });
      const balanceItems = [...productMap.values()];
      if (balanceItems.length === 0) {
        response.status(422).json({ error: { code: "CATEGORY_EMPTY", message: "Esta categoria nao possui produtos ativos.", details: [] } });
        return;
      }
      const productIds = balanceItems.map((item) => item.productId);

      const balance = await prisma.$transaction(async (transaction) => {
        const sellers = await transaction.user.findMany({
          where: { id: { in: input.sellerIds }, role: "VENDEDOR", active: true },
          select: { id: true }
        });
        if (sellers.length !== input.sellerIds.length) throw new Error("ASSIGNEE_NOT_ACTIVE_SELLER");
        const products = await transaction.product.findMany({
          where: { id: { in: productIds }, active: true },
          select: { id: true, unit: true }
        });
        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_FOUND_OR_INACTIVE");
        }
        const units = new Map(products.map((product) => [product.id, product.unit]));
        const createdBalance = await transaction.balance.create({
          data: {
            name: input.name,
            kind: input.kind,
            categoryId: input.kind === "CATEGORIA" && categoryIds.length === 1 ? categoryIds[0] ?? null : null,
            selectedCategories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
            createdById: currentUser.id,
            assignments: { create: input.sellerIds.map((userId) => ({ userId })) },
            items: {
              create: expandSizeGrid(balanceItems, units).map((item) => ({
                productId: item.productId,
                size: item.size,
                referenceQuantity: new Prisma.Decimal(item.referenceQuantity),
                selectedIndividually: item.selectedIndividually
              }))
            }
          },
          select: { id: true, name: true, kind: true, categoryId: true, selectedCategories: { select: { category: { select: { id: true, name: true } } } }, status: true, createdAt: true, assignments: { select: { user: { select: { id: true, name: true } } } } }
        });
        await transaction.audit.create({
          data: {
            userId: currentUser.id,
            action: "BALANCE_CREATED",
            objectType: "BALANCE",
            objectId: createdBalance.id,
            metadata: { sellerIds: input.sellerIds }
          }
        });
        return createdBalance;
      });
      response.status(201).json({
        ...balance,
        createdAt: balance.createdAt.toISOString(),
        assignedSellers: balance.assignments.map(({ user: assignedSeller }) => assignedSeller)
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ASSIGNEE_NOT_ACTIVE_SELLER") {
        response.status(422).json({ error: { code: "ASSIGNEE_NOT_ACTIVE_SELLER", message: "Selecione somente vendedores ativos.", details: [] } });
        return;
      }
      if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND_OR_INACTIVE") {
        response.status(422).json({
          error: { code: "PRODUCT_NOT_FOUND_OR_INACTIVE", message: "Todos os produtos devem existir e estar ativos.", details: [] }
        });
        return;
      }
      next(error);
    }
  });

  router.get("/balances/:id/draft", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const balanceId = idSchema.parse(request.params.id);
      const balance = await prisma.balance.findUnique({
        where: { id: balanceId },
        select: { id: true, name: true, kind: true, categoryId: true, status: true,
          assignments: { select: { userId: true } },
          selectedCategories: { select: { categoryId: true } },
          items: { where: { selectedIndividually: true }, distinct: ["productId"], select: { productId: true, referenceQuantity: true } } }
      });
      if (!balance) { response.status(404).json({ error: { code: "BALANCE_NOT_FOUND", message: "Balanço não encontrado.", details: [] } }); return; }
      if (balance.kind !== "PERSONALIZADO" || balance.status !== "RASCUNHO") {
        response.status(409).json({ error: { code: "CUSTOM_DRAFT_ONLY", message: "Somente balanços personalizados em rascunho podem ser editados.", details: [] } }); return;
      }
      response.json({ ...balance, categoryIds: balance.selectedCategories.map(({ categoryId }) => categoryId), items: balance.items.map((item) => ({ ...item, referenceQuantity: item.referenceQuantity.toString() })) });
    } catch (error) { next(error); }
  });

  router.put("/balances/:id/custom", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      const input = z.object({ name: z.string().trim().min(1).max(160), sellerIds: z.array(idSchema).min(1).max(500), categoryIds: z.array(idSchema).max(500).default([]), items: z.array(productSelectionSchema).max(10000).default([]) }).parse(request.body);
      if (!input.categoryIds.length && !input.items.length) { response.status(400).json({ error: { code: "INVALID_BALANCE_SOURCE", message: "Selecione ao menos uma categoria ou um produto.", details: [] } }); return; }
      if (new Set(input.categoryIds).size !== input.categoryIds.length) { response.status(400).json({ error: { code: "DUPLICATE_CATEGORY", message: "Uma categoria nao pode ser selecionada duas vezes.", details: [] } }); return; }
      if (new Set(input.sellerIds).size !== input.sellerIds.length || new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
        response.status(400).json({ error: { code: "DUPLICATE_SELECTION", message: "Não repita vendedores ou produtos.", details: [] } }); return;
      }
      await prisma.$transaction(async (transaction) => {
        const balance = await transaction.balance.findUnique({ where: { id: balanceId }, select: { kind: true, status: true } });
        if (!balance) throw new Error("BALANCE_NOT_FOUND");
        if (balance.kind !== "PERSONALIZADO" || balance.status !== "RASCUNHO") throw new Error("CUSTOM_DRAFT_ONLY");
        const [sellers, products, categories] = await Promise.all([
          transaction.user.findMany({ where: { id: { in: input.sellerIds }, role: "VENDEDOR", active: true }, select: { id: true } }),
          transaction.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, active: true }, select: { id: true, unit: true } }),
          transaction.category.findMany({ where: { id: { in: input.categoryIds }, active: true }, select: { id: true } })
        ]);
        if (sellers.length !== input.sellerIds.length) throw new Error("ASSIGNEE_NOT_ACTIVE_SELLER");
        if (products.length !== input.items.length) throw new Error("PRODUCT_NOT_FOUND_OR_INACTIVE");
        if (categories.length !== input.categoryIds.length) throw new Error("CATEGORY_NOT_FOUND_OR_INACTIVE");
        const categoryProducts = input.categoryIds.length ? await transaction.product.findMany({ where: { categoryId: { in: input.categoryIds }, active: true }, select: { id: true, unit: true } }) : [];
        const productMap = new Map<string, SelectedProduct>();
        for (const product of categoryProducts) productMap.set(product.id, { productId: product.id, referenceQuantity: "0", selectedIndividually: false });
        for (const item of input.items) productMap.set(item.productId, { ...item, selectedIndividually: true });
        if (!productMap.size) throw new Error("CATEGORY_EMPTY");
        await transaction.balance.update({ where: { id: balanceId }, data: { name: input.name } });
        await transaction.balanceItem.deleteMany({ where: { balanceId } });
        const units = new Map([...products, ...categoryProducts].map((product) => [product.id, product.unit]));
        await transaction.balanceItem.createMany({ data: expandSizeGrid([...productMap.values()], units).map((item) => ({ balanceId, productId: item.productId, size: item.size, referenceQuantity: new Prisma.Decimal(item.referenceQuantity), selectedIndividually: item.selectedIndividually })) });
        await transaction.balanceCategory.deleteMany({ where: { balanceId } });
        if (input.categoryIds.length) await transaction.balanceCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ balanceId, categoryId })) });
        await transaction.balanceAssignment.deleteMany({ where: { balanceId } });
        await transaction.balanceAssignment.createMany({ data: input.sellerIds.map((userId) => ({ balanceId, userId })) });
        await transaction.audit.create({ data: { userId: currentUser.id, action: "CUSTOM_BALANCE_UPDATED", objectType: "BALANCE", objectId: balanceId, metadata: { sellerIds: input.sellerIds, categoryIds: input.categoryIds, productCount: productMap.size } } });
      });
      response.json({ id: balanceId, updated: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const status = code === "BALANCE_NOT_FOUND" ? 404 : code === "CUSTOM_DRAFT_ONLY" ? 409 : code === "ASSIGNEE_NOT_ACTIVE_SELLER" || code === "PRODUCT_NOT_FOUND_OR_INACTIVE" || code === "CATEGORY_NOT_FOUND_OR_INACTIVE" || code === "CATEGORY_EMPTY" ? 422 : 0;
      if (status) { response.status(status).json({ error: { code, message: code === "CUSTOM_DRAFT_ONLY" ? "Somente balanços personalizados em rascunho podem ser editados." : "Os dados selecionados não são válidos.", details: [] } }); return; }
      next(error);
    }
  });

  router.delete("/balances/:id/custom", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      await prisma.$transaction(async (transaction) => {
        const balance = await transaction.balance.findUnique({ where: { id: balanceId }, select: { kind: true, status: true } });
        if (!balance) throw new Error("BALANCE_NOT_FOUND");
        if (balance.kind !== "PERSONALIZADO" || balance.status !== "RASCUNHO") throw new Error("CUSTOM_DRAFT_ONLY");
        await transaction.audit.create({ data: { userId: currentUser.id, action: "CUSTOM_BALANCE_DELETED", objectType: "BALANCE", objectId: balanceId } });
        await transaction.balanceItem.deleteMany({ where: { balanceId } });
        await transaction.balanceAssignment.deleteMany({ where: { balanceId } });
        await transaction.balance.delete({ where: { id: balanceId } });
      });
      response.status(204).end();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "BALANCE_NOT_FOUND" || code === "CUSTOM_DRAFT_ONLY") { response.status(code === "BALANCE_NOT_FOUND" ? 404 : 409).json({ error: { code, message: code === "CUSTOM_DRAFT_ONLY" ? "Somente balanços personalizados em rascunho podem ser excluídos." : "Balanço não encontrado.", details: [] } }); return; }
      next(error);
    }
  });

  router.put("/balances/:id/assignees", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      const input = z.object({ sellerIds: z.array(idSchema).min(1).max(500) }).parse(request.body);
      if (new Set(input.sellerIds).size !== input.sellerIds.length) {
        response.status(400).json({ error: { code: "DUPLICATE_SELLER", message: "Um vendedor nao pode ser selecionado duas vezes.", details: [] } });
        return;
      }
      const sellers = await prisma.user.findMany({ where: { id: { in: input.sellerIds }, role: "VENDEDOR", active: true }, select: { id: true } });
      if (sellers.length !== input.sellerIds.length) {
        response.status(422).json({ error: { code: "ASSIGNEE_NOT_ACTIVE_SELLER", message: "Selecione somente vendedores ativos.", details: [] } });
        return;
      }
      const updated = await prisma.$transaction(async (transaction) => {
        const balance = await transaction.balance.findUnique({ where: { id: balanceId }, select: { status: true, kind: true } });
        if (!balance) throw new Error("BALANCE_NOT_FOUND");
        if (balance.status !== "RASCUNHO") throw new Error("ASSIGNEES_LOCKED");
        await transaction.balanceAssignment.deleteMany({ where: { balanceId } });
        await transaction.balanceAssignment.createMany({ data: input.sellerIds.map((userId) => ({ balanceId, userId })) });
        await transaction.audit.create({ data: { userId: currentUser.id, action: "BALANCE_ASSIGNEES_UPDATED", objectType: "BALANCE", objectId: balanceId, metadata: { sellerIds: input.sellerIds } } });
        return transaction.balanceAssignment.findMany({ where: { balanceId }, select: { user: { select: { id: true, name: true, login: true, active: true } } } });
      });
      response.json({ assignedSellers: updated.map(({ user: assignedSeller }) => assignedSeller) });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "BALANCE_NOT_FOUND" || code === "ASSIGNEES_LOCKED") {
        response.status(code === "BALANCE_NOT_FOUND" ? 404 : 409).json({ error: { code, message: code === "BALANCE_NOT_FOUND" ? "Balanço nao encontrado." : "Os vendedores so podem ser alterados enquanto o balanco esta em rascunho.", details: [] } });
        return;
      }
      next(error);
    }
  });

  router.post("/balances/:id/open", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      const openedBalance = await prisma.$transaction(async (transaction) => {
        const balance = await transaction.balance.findUnique({
          where: { id: balanceId },
          include: { items: { select: { productId: true } }, assignments: { where: { user: { role: "VENDEDOR", active: true } }, select: { userId: true } } }
        });
        if (!balance) throw new Error("BALANCE_NOT_FOUND");
        if (balance.status !== "RASCUNHO") throw new Error("BALANCE_NOT_DRAFT");
        if (balance.items.length === 0) throw new Error("BALANCE_EMPTY");
        if (balance.assignments.length === 0) throw new Error("BALANCE_NO_SELLERS");

        const productIds = balance.items.map((item) => item.productId);
        const overlap = await transaction.balanceItem.findFirst({
          where: {
            productId: { in: productIds },
            balance: { status: { in: ["ABERTO", "EM_REVISAO"] } }
          },
          select: { productId: true }
        });
        if (overlap) throw new Error("BALANCE_PRODUCT_OVERLAP");

        const updated = await transaction.balance.update({
          where: { id: balanceId },
          data: { status: "ABERTO", openedAt: new Date() },
          select: { id: true, name: true, status: true, openedAt: true }
        });
        await transaction.audit.create({
          data: {
            userId: currentUser.id,
            action: "BALANCE_OPENED",
            objectType: "BALANCE",
            objectId: balanceId
          }
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      response.json({
        ...openedBalance,
        openedAt: openedBalance.openedAt?.toISOString() ?? null
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const knownErrors: Record<string, { status: number; message: string }> = {
        BALANCE_NOT_FOUND: { status: 404, message: "Balanço nao encontrado." },
        BALANCE_NOT_DRAFT: { status: 409, message: "Somente balancos em rascunho podem ser abertos." },
        BALANCE_EMPTY: { status: 422, message: "O balanco precisa ter ao menos um item." },
        BALANCE_NO_SELLERS: { status: 422, message: "Destine o balanco a pelo menos um vendedor ativo antes de abri-lo." },
        BALANCE_PRODUCT_OVERLAP: { status: 409, message: "Um ou mais produtos ja pertencem a outro balanco aberto." }
      };
      const known = knownErrors[code];
      if (known) {
        response.status(known.status).json({
          error: { code, message: known.message, details: [] }
        });
        return;
      }
      next(error);
    }
  });

  router.get("/balances/:id/items", requireAuthentication, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      const status = z.enum(["PENDENTE", "CONTADO", "EM_REVISAO", "APROVADO"]).optional().parse(request.query.status);
      if (currentUser.role === "VENDEDOR") {
        const assignment = await prisma.balanceAssignment.findUnique({ where: { balanceId_userId: { balanceId, userId: currentUser.id } }, select: { balanceId: true } });
        if (!assignment) {
          response.status(403).json({ error: { code: "BALANCE_NOT_ASSIGNED", message: "Este balanço nao foi destinado a voce.", details: [] } });
          return;
        }
      }
      const items = await prisma.balanceItem.findMany({
        where: {
          balanceId,
          ...(status ? { status } : {}),
          balance: { status: { in: ["ABERTO", "EM_REVISAO"] } }
        },
        orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
        select: {
          id: true,
          size: true,
          referenceQuantity: true,
          status: true,
          product: {
            select: {
              id: true, internalCode: true, name: true, unit: true, photoUrl: true,
              category: { select: { id: true, name: true } }
            }
          },
          counts: {
            ...(currentUser.role === "VENDEDOR" ? { where: { userId: currentUser.id } } : {}),
            orderBy: { countedAt: "desc" },
            select: { id: true, quantity: true, countedAt: true, observation: true, isRecount: true, user: { select: { id: true, name: true } } }
          }
        }
      });
      response.json({
        data: items.map((item) => ({
          id: item.id,
          size: item.size || null,
          referenceQuantity: item.referenceQuantity.toString(),
          status: item.status,
          product: item.product,
          counts: item.counts.map(serializeCount)
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/balances/:balanceId/items/:itemId/counts", requireAuthentication, async (request, response, next) => {
    try {
      const currentUser = user(response);
      if (currentUser.role !== "VENDEDOR") {
        response.status(403).json({
          error: { code: "FORBIDDEN", message: "Somente vendedores registram a primeira contagem.", details: [] }
        });
        return;
      }
      const balanceId = idSchema.parse(request.params.balanceId);
      const itemId = idSchema.parse(request.params.itemId);
      const idempotencyKey = z.string().uuid().parse(request.header("Idempotency-Key"));
      const input = z.object({
        quantity: quantitySchema,
        observation: z.string().trim().max(500).optional()
      }).parse(request.body);

      const count = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.count.findUnique({
          where: { idempotencyKey },
          include: { user: { select: { id: true, name: true } } }
        });
        if (existing) {
          if (existing.userId !== currentUser.id || existing.balanceItemId !== itemId) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          return existing;
        }

        const item = await transaction.balanceItem.findFirst({
          where: { id: itemId, balanceId, balance: { status: { in: ["ABERTO", "EM_REVISAO"] }, assignments: { some: { userId: currentUser.id } } } },
          select: { id: true, status: true }
        });
        if (!item) throw new Error("ITEM_NOT_AVAILABLE");
        if (item.status !== "PENDENTE" && item.status !== "EM_REVISAO") throw new Error("ITEM_ALREADY_COUNTED");

        const created = await transaction.count.create({
          data: {
            balanceItemId: itemId,
            userId: currentUser.id,
            quantity: new Prisma.Decimal(input.quantity),
            observation: input.observation ?? null,
            idempotencyKey,
            isRecount: item.status === "EM_REVISAO"
          },
          include: { user: { select: { id: true, name: true } } }
        });
        await transaction.balanceItem.update({
          where: { id: itemId },
          data: { status: "CONTADO" }
        });
        await transaction.audit.create({
          data: {
            userId: currentUser.id,
            action: "COUNT_REGISTERED",
            objectType: "BALANCE_ITEM",
            objectId: itemId
          }
        });
        const balanceItems = await transaction.balanceItem.findMany({ where: { balanceId }, select: { status: true } });
        if (balanceItems.length > 0 && balanceItems.every(({ status }) => status === "CONTADO" || status === "APROVADO")) {
          const closed = await transaction.balance.updateMany({
            where: { id: balanceId, status: { in: ["ABERTO", "EM_REVISAO"] } },
            data: { status: "ENCERRADO", closedAt: new Date() }
          });
          if (closed.count > 0) {
            await transaction.audit.create({
              data: { userId: currentUser.id, action: "BALANCE_CLOSED", objectType: "BALANCE", objectId: balanceId }
            });
          }
        }
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      response.status(201).json(serializeCount(count));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const knownErrors: Record<string, { status: number; message: string }> = {
        IDEMPOTENCY_CONFLICT: { status: 409, message: "A chave de idempotencia ja foi usada em outra operacao." },
        ITEM_NOT_AVAILABLE: { status: 404, message: "Item nao encontrado ou balanco nao esta aberto." },
        ITEM_ALREADY_COUNTED: { status: 409, message: "Este item ja possui uma primeira contagem." }
      };
      const known = knownErrors[code];
      if (known) {
        response.status(known.status).json({
          error: { code, message: known.message, details: [] }
        });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicateKey = request.header("Idempotency-Key");
        if (duplicateKey) {
          const duplicate = await prisma.count.findUnique({ where: { idempotencyKey: duplicateKey }, include: { user: { select: { id: true, name: true } } } });
          if (duplicate && duplicate.userId === user(response).id && duplicate.balanceItemId === request.params.itemId) {
            response.status(200).json(serializeCount(duplicate));
            return;
          }
          if (duplicate) {
            response.status(409).json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "A chave de idempotencia ja foi usada em outra operacao.", details: [] } });
            return;
          }
        }
        response.status(409).json({
          error: { code: "ITEM_ALREADY_COUNTED", message: "Este item ja possui uma primeira contagem.", details: [] }
        });
        return;
      }
      next(error);
    }
  });

  router.post("/balances/:balanceId/items/:itemId/recounts", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.balanceId);
      const itemId = idSchema.parse(request.params.itemId);
      const input = z.object({ reason: z.string().trim().min(1).max(500) }).parse(request.body);
      const item = await prisma.balanceItem.findFirst({
        where: { id: itemId, balanceId, balance: { status: { in: ["ABERTO", "EM_REVISAO"] } }, status: "CONTADO" },
        select: { id: true }
      });
      if (!item) {
        response.status(409).json({
          error: { code: "RECOUNT_NOT_ALLOWED", message: "Somente itens contados de um balanco aberto podem entrar em recontagem.", details: [] }
        });
        return;
      }
      await prisma.$transaction(async (transaction) => {
        await transaction.balanceItem.update({ where: { id: itemId }, data: { status: "EM_REVISAO" } });
        await transaction.audit.create({
          data: {
            userId: currentUser.id,
            action: "RECOUNT_AUTHORIZED",
            objectType: "BALANCE_ITEM",
            objectId: itemId,
            metadata: { reason: input.reason }
          }
        });
      });
      response.status(202).json({ itemId, status: "EM_REVISAO" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/balances/:balanceId/items/:itemId/approve", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.balanceId);
      const itemId = idSchema.parse(request.params.itemId);
      const input = z.object({
        countId: idSchema.optional(),
        adjustmentQuantity: quantitySchema.optional(),
        reason: z.string().trim().max(500).optional()
      }).parse(request.body);
      if ((!input.countId && !input.adjustmentQuantity) || (input.countId && input.adjustmentQuantity) ||
        (input.adjustmentQuantity && !input.reason)) {
        response.status(400).json({
          error: { code: "APPROVAL_INPUT_INVALID", message: "Escolha uma contagem ou informe ajuste com justificativa.", details: [] }
        });
        return;
      }
      const result = await prisma.$transaction(async (transaction) => {
        const item = await transaction.balanceItem.findFirst({
          where: { id: itemId, balanceId, status: { in: ["CONTADO", "EM_REVISAO"] } },
          select: { id: true }
        });
        if (!item) throw new Error("ITEM_NOT_APPROVABLE");
        let finalQuantity: Prisma.Decimal;
        let approvedCountId: string | undefined;
        if (input.countId) {
          const count = await transaction.count.findFirst({
            where: { id: input.countId, balanceItemId: itemId },
            select: { id: true, quantity: true }
          });
          if (!count) throw new Error("COUNT_NOT_FOUND");
          finalQuantity = count.quantity;
          approvedCountId = count.id;
        } else {
          finalQuantity = new Prisma.Decimal(input.adjustmentQuantity as string);
        }
        const updated = await transaction.balanceItem.update({
          where: { id: itemId },
          data: {
            finalQuantity,
            approvedCountId: approvedCountId ?? null,
            approvedById: currentUser.id,
            approvedAt: new Date(),
            status: "APROVADO"
          },
          select: { id: true, finalQuantity: true, status: true, approvedAt: true }
        });
        await transaction.audit.create({
          data: {
            userId: currentUser.id,
            action: input.countId ? "COUNT_APPROVED" : "COUNT_ADJUSTED",
            objectType: "BALANCE_ITEM",
            objectId: itemId,
            metadata: { reason: input.reason ?? null, countId: input.countId ?? null }
          }
        });
        return updated;
      });
      response.json({
        ...result,
        finalQuantity: result.finalQuantity?.toString() ?? null,
        approvedAt: result.approvedAt?.toISOString() ?? null
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "ITEM_NOT_APPROVABLE" || code === "COUNT_NOT_FOUND") {
        response.status(409).json({
          error: { code, message: code === "COUNT_NOT_FOUND" ? "Contagem nao pertence ao item." : "Item ainda nao esta pronto para aprovacao.", details: [] }
        });
        return;
      }
      next(error);
    }
  });

  router.post("/balances/:id/close", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const currentUser = user(response);
      const balanceId = idSchema.parse(request.params.id);
      const closed = await prisma.$transaction(async (transaction) => {
        const balance = await transaction.balance.findUnique({
          where: { id: balanceId },
          include: { items: { select: { status: true } } }
        });
        if (!balance) throw new Error("BALANCE_NOT_FOUND");
        if (!["ABERTO", "EM_REVISAO"].includes(balance.status)) throw new Error("BALANCE_NOT_CLOSABLE");
        const updated = await transaction.balance.update({
          where: { id: balanceId },
          data: { status: "ENCERRADO", closedAt: new Date() },
          select: { id: true, status: true, closedAt: true }
        });
        await transaction.audit.create({
          data: { userId: currentUser.id, action: "BALANCE_CLOSED", objectType: "BALANCE", objectId: balanceId }
        });
        return updated;
      });
      response.json({ ...closed, closedAt: closed.closedAt?.toISOString() ?? null });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        BALANCE_NOT_FOUND: "Balanço nao encontrado.",
        BALANCE_NOT_CLOSABLE: "Somente balancos abertos ou em revisao podem ser encerrados."
      };
      if (messages[code]) {
        response.status(code === "BALANCE_NOT_FOUND" ? 404 : 409).json({
          error: { code, message: messages[code], details: [] }
        });
        return;
      }
      next(error);
    }
  });
}
