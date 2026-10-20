import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "./database.js";

const credentialsSchema = z.object({
  login: z.string().trim().toLowerCase().min(1).max(120),
  password: z.string().min(1).max(200)
});

const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(["ADMIN", "VENDEDOR"]),
  sv: z.number().int().nonnegative()
});

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export async function authenticate(login: string, password: string) {
  const credentials = credentialsSchema.parse({ login, password });
  const user = await prisma.user.findUnique({ where: { login: credentials.login } });

  if (!user || !user.active || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
    return null;
  }

  const token = jwt.sign({ role: user.role, sv: user.sessionVersion }, getJwtSecret(), {
    subject: user.id,
    expiresIn: "8h"
  });

  return {
    token,
    user: { id: user.id, name: user.name, login: user.login, role: user.role }
  };
}

export function readToken(token: string) {
  const decoded = jwt.verify(token, getJwtSecret());
  return tokenPayloadSchema.parse(decoded);
}

export async function getAuthenticatedUser(token: string) {
  const payload = readToken(token);
  const user = await prisma.user.findFirst({
    where: { id: payload.sub, active: true },
    select: { id: true, name: true, login: true, role: true, sessionVersion: true }
  });
  if (!user || user.sessionVersion !== payload.sv) return null;
  const { sessionVersion: _sessionVersion, ...safeUser } = user;
  return safeUser;
}
