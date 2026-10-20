import type { NextFunction, Request, Response, Router } from "express";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./database.js";
import { requireAdmin, requireAuthentication, type AuthenticatedUser } from "./http-auth.js";
import { ipRateLimit } from "./rate-limit.js";

const idSchema = z.string().uuid();
const userSelect = { id: true, name: true, login: true, role: true, active: true, createdAt: true, updatedAt: true } as const;
const nameSchema = z.string().trim().min(1).max(120);
const loginSchema = z.string().trim().toLowerCase().min(1).max(120);
const passwordSchema = z.string().min(12).max(200);
const activeAdminMutationLock = 724_202_610_161n;

async function lockActiveAdminMutations(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${activeAdminMutationLock}) IS NULL AS locked`;
}

function currentUser(response: Response) {
  return response.locals.user as AuthenticatedUser;
}

function databaseError(error: unknown, response: Response, next: NextFunction) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    response.status(409).json({ error: { code: "DUPLICATE_LOGIN", message: "Este login ja esta em uso.", details: [] } });
    return;
  }
  next(error);
}

export function registerUserRoutes(router: Router) {
  router.get("/users", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const query = z.object({
        q: z.string().trim().max(120).optional(),
        role: z.enum(["ADMIN", "VENDEDOR"]).optional(),
        active: z.enum(["true", "false"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50)
      }).parse(request.query);
      const where = {
        ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { login: { contains: query.q, mode: "insensitive" as const } }] } : {}),
        ...(query.role ? { role: query.role } : {}),
        ...(query.active ? { active: query.active === "true" } : {})
      };
      const [data, total] = await Promise.all([
        prisma.user.findMany({ where, select: userSelect, orderBy: { name: "asc" }, skip: (query.page - 1) * query.limit, take: query.limit }),
        prisma.user.count({ where })
      ]);
      response.json({ data, page: query.page, limit: query.limit, total });
    } catch (error) { next(error); }
  });

  router.get("/users/:id", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
      if (!user) { response.status(404).json({ error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado.", details: [] } }); return; }
      response.json(user);
    } catch (error) { next(error); }
  });

  router.post("/users", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const input = z.object({ name: nameSchema, login: loginSchema, password: passwordSchema, role: z.enum(["VENDEDOR", "ADMIN"]).default("VENDEDOR") }).parse(request.body);
      const actor = currentUser(response);
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { name: input.name, login: input.login, passwordHash: await bcrypt.hash(input.password, 12), role: input.role }, select: userSelect });
        await tx.audit.create({ data: { userId: actor.id, action: "USER_CREATED", objectType: "USER", objectId: user.id, metadata: { role: user.role, login: user.login } } });
        return user;
      });
      response.status(201).json(created);
    } catch (error) { databaseError(error, response, next); }
  });

  router.patch("/users/:id", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const input = z.object({ name: nameSchema.optional(), login: loginSchema.optional(), role: z.enum(["VENDEDOR", "ADMIN"]).optional() }).refine((value) => Object.keys(value).length > 0).parse(request.body);
      const actor = currentUser(response);
      const result = await prisma.$transaction(async (tx) => {
        if (input.role === "VENDEDOR") await lockActiveAdminMutations(tx);
        const before = await tx.user.findUnique({ where: { id }, select: userSelect });
        if (!before) throw new Error("USER_NOT_FOUND");
        if (before.role === "ADMIN" && before.active && input.role === "VENDEDOR") {
          const count = await tx.user.count({ where: { role: "ADMIN", active: true } });
          if (count <= 1) throw new Error("LAST_ACTIVE_ADMIN");
        }
        const credentialChanged =
          (input.login !== undefined && input.login !== before.login) ||
          (input.role !== undefined && input.role !== before.role);
        const updated = await tx.user.update({ where: { id }, data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.login !== undefined ? { login: input.login } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(credentialChanged ? { sessionVersion: { increment: 1 } } : {})
        }, select: userSelect });
        await tx.audit.create({ data: { userId: actor.id, action: "USER_UPDATED", objectType: "USER", objectId: id, metadata: { changes: input } } });
        return updated;
      });
      response.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "USER_NOT_FOUND" || code === "LAST_ACTIVE_ADMIN") { response.status(code === "USER_NOT_FOUND" ? 404 : 409).json({ error: { code, message: code === "USER_NOT_FOUND" ? "Usuario nao encontrado." : "Nao e permitido remover o ultimo administrador ativo.", details: [] } }); return; }
      databaseError(error, response, next);
    }
  });

  router.patch("/users/:id/status", requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const input = z.object({ active: z.boolean(), reason: z.string().trim().min(1).max(500) }).parse(request.body);
      const actor = currentUser(response);
      const result = await prisma.$transaction(async (tx) => {
        if (!input.active) await lockActiveAdminMutations(tx);
        const before = await tx.user.findUnique({ where: { id }, select: userSelect });
        if (!before) throw new Error("USER_NOT_FOUND");
        if (!input.active && before.active && before.role === "ADMIN" && await tx.user.count({ where: { role: "ADMIN", active: true } }) <= 1) throw new Error("LAST_ACTIVE_ADMIN");
        const user = await tx.user.update({ where: { id }, data: { active: input.active, sessionVersion: { increment: 1 } }, select: userSelect });
        await tx.audit.create({ data: { userId: actor.id, action: input.active ? "USER_ACTIVATED" : "USER_DEACTIVATED", objectType: "USER", objectId: id, metadata: { reason: input.reason } } });
        return user;
      });
      response.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (["USER_NOT_FOUND", "LAST_ACTIVE_ADMIN"].includes(code)) { response.status(code === "USER_NOT_FOUND" ? 404 : 409).json({ error: { code, message: code === "USER_NOT_FOUND" ? "Usuario nao encontrado." : "Nao e permitido inativar o ultimo administrador ativo.", details: [] } }); return; }
      next(error);
    }
  });

  router.post("/users/:id/reset-password", ipRateLimit(15 * 60 * 1000, 10), requireAuthentication, requireAdmin, async (request, response, next) => {
    try {
      const id = idSchema.parse(request.params.id);
      const { password } = z.object({ password: passwordSchema }).parse(request.body);
      const actor = currentUser(response);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } } });
        await tx.audit.create({ data: { userId: actor.id, action: "USER_PASSWORD_RESET", objectType: "USER", objectId: id } });
      });
      response.status(204).send();
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2025") { response.status(404).json({ error: { code: "USER_NOT_FOUND", message: "Usuario nao encontrado.", details: [] } }); return; }
      next(error);
    }
  });

  router.post("/auth/change-password", requireAuthentication, async (request, response, next) => {
    try {
      const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }).parse(request.body);
      const actor = currentUser(response);
      const user = await prisma.user.findUnique({ where: { id: actor.id } });
      if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) { response.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "Senha atual invalida.", details: [] } }); return; }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: { increment: 1 } } });
        await tx.audit.create({ data: { userId: actor.id, action: "USER_PASSWORD_CHANGED", objectType: "USER", objectId: actor.id } });
      });
      response.status(204).send();
    } catch (error) { next(error); }
  });
}
