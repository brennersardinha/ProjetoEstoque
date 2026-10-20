import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const [name, login, password, requestedRole = "ADMIN"] = process.argv.slice(2);
const normalizedName = name?.trim();
const normalizedLogin = login?.trim().toLowerCase();
const role = requestedRole.toUpperCase();
if (!normalizedName || !normalizedLogin || normalizedName.length > 120 || normalizedLogin.length > 120 || !password || password.length < 12 || !["ADMIN", "VENDEDOR"].includes(role)) {
  console.error("Uso: node scripts/create-admin.mjs \"Nome\" login senha-com-no-minimo-12-caracteres [ADMIN|VENDEDOR]");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name: normalizedName, login: normalizedLogin, passwordHash, role }
  });
  console.log(`${role} ${normalizedLogin} criado com sucesso.`);
} finally {
  await prisma.$disconnect();
}
