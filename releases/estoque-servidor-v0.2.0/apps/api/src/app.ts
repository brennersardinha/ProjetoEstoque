import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import { authenticate, getAuthenticatedUser } from "./auth.js";
import { registerCatalogRoutes } from "./catalog.js";
import { registerBalanceRoutes } from "./balances.js";
import { registerImportRoutes } from "./imports.js";
import { registerUserRoutes } from "./users.js";
import { requireAuthentication } from "./http-auth.js";
import { ipRateLimit } from "./rate-limit.js";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173")
});

export function createApp() {
  const environment = environmentSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    WEB_ORIGIN: process.env.WEB_ORIGIN
  });

  const app = express();
  const productPhotoDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads/products");
  app.disable("x-powered-by");
  app.use(helmet());
  const allowedOrigins = environment.WEB_ORIGIN
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => z.string().url().parse(origin));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS."));
    }
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/uploads/products", express.static(productPhotoDirectory, { maxAge: "1d", immutable: true, dotfiles: "deny" }));

  app.post("/api/auth/login", ipRateLimit(15 * 60 * 1000, 10), async (request, response, next) => {
    try {
      const credentials = z.object({
        login: z.string(),
        password: z.string()
      }).parse(request.body);
      const result = await authenticate(credentials.login, credentials.password);
      if (!result) {
        response.status(401).json({
          error: { code: "UNAUTHENTICATED", message: "Credenciais invalidas.", details: [] }
        });
        return;
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", async (request, response, next) => {
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
      response.json({ user });
    } catch (error) {
      if (error instanceof Error && (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError" || error.name === "ZodError")) {
        response.status(401).json({
          error: { code: "UNAUTHENTICATED", message: "Sessao invalida ou expirada.", details: [] }
        });
        return;
      }
      next(error);
    }
  });

  app.post("/api/auth/logout", (_request, response) => {
    response.status(204).send();
  });

  const apiRouter = express.Router();
  registerCatalogRoutes(apiRouter);
  registerUserRoutes(apiRouter);
  registerBalanceRoutes(apiRouter);
  registerImportRoutes(apiRouter);
  app.use("/api", apiRouter);

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "estoque-api",
      environment: environment.NODE_ENV
    });
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Recurso nao encontrado.",
        details: []
      }
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      response.status(tooLarge ? 413 : 400).json({
        error: { code: error.code, message: tooLarge ? "A foto deve ter no máximo 5 MB." : "O arquivo da foto não foi aceito.", details: [] }
      });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados invalidos.",
          details: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message
          }))
        }
      });
      return;
    }
    console.error(error);
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocorreu um erro interno.",
        details: []
      }
    });
  });

  return { app, environment };
}
