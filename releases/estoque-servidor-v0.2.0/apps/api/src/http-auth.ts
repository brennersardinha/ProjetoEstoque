import type { NextFunction, Request, Response } from "express";
import { getAuthenticatedUser } from "./auth.js";

export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;

export async function requireAuthentication(request: Request, response: Response, next: NextFunction) {
  try {
    const authorization = request.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Autenticacao necessaria.", details: [] }
      });
      return;
    }

    const user = await getAuthenticatedUser(token);
    if (!user) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Sessao invalida ou expirada.", details: [] }
      });
      return;
    }

    response.locals.user = user;
    next();
  } catch (error) {
    if (error instanceof Error && (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError" || error.name === "ZodError")) {
      response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Sessao invalida ou expirada.", details: [] }
      });
      return;
    }
    next(error);
  }
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const user = response.locals.user as AuthenticatedUser | undefined;
  if (!user || user.role !== "ADMIN") {
    response.status(403).json({
      error: { code: "FORBIDDEN", message: "Acesso restrito ao administrador.", details: [] }
    });
    return;
  }
  next();
}
