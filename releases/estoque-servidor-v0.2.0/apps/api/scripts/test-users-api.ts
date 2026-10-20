import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL e obrigatoria; use um banco descartavel, nunca o banco operacional.");
}
const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\/+/, ""));
if (!/(^|[_-])test([_-]|$)/i.test(testDatabaseName)) {
  throw new Error("O nome do banco em TEST_DATABASE_URL deve conter o segmento 'test' (por exemplo, estoque_users_api_test).");
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL === testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL nao pode ser o mesmo valor de DATABASE_URL.");
}
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET ?? "integration-only-secret-with-at-least-32-characters";

const [{ createApp }, { prisma }] = await Promise.all([
  import("../src/app.js"),
  import("../src/database.js")
]);
const { app } = createApp();
const unique = crypto.randomUUID();
const adminPassword = "AdminPassword123!";
const initialSellerPassword = "SellerPassword123!";
const resetSellerPassword = "ResetSellerPassword123!";
const changedSellerPassword = "ChangedSellerPassword123!";
const admin = await prisma.user.create({
  data: {
    name: `API test admin ${unique}`,
    login: `api-admin-${unique}`,
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "ADMIN"
  }
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
async function login(login: string, password: string) {
  return request(app).post("/api/auth/login").send({ login, password });
}

try {
  const adminLogin = await login(admin.login, adminPassword);
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token as string;

  const missingMeToken = await request(app).get("/api/auth/me");
  assert.equal(missingMeToken.status, 401);
  const missingBalanceToken = await request(app).get("/api/balances");
  assert.equal(missingBalanceToken.status, 401);
  const tamperedToken = `${adminToken.slice(0, -1)}${adminToken.endsWith("a") ? "b" : "a"}`;
  assert.equal((await request(app).get("/api/auth/me").set(auth(tamperedToken))).status, 401);
  const expiredToken = jwt.sign({ role: "ADMIN", sv: admin.sessionVersion }, process.env.JWT_SECRET!, { subject: admin.id, expiresIn: -1 });
  assert.equal((await request(app).get("/api/auth/me").set(auth(expiredToken))).status, 401);

  const unauthenticated = await request(app).get("/api/users");
  assert.equal(unauthenticated.status, 401);
  const invalidKnownLogin = await login(admin.login, "invalid-password");
  const invalidUnknownLogin = await login(`unknown-${unique}`, "invalid-password");
  assert.equal(invalidKnownLogin.status, 401);
  assert.deepEqual(invalidKnownLogin.body.error, invalidUnknownLogin.body.error, "login errors must not disclose whether the account exists");

  const invalidUser = await request(app).post("/api/users").set(auth(adminToken)).send({
    name: " ", login: `bad-${unique}`, password: "short", role: "UNKNOWN"
  });
  assert.equal(invalidUser.status, 400);

  const shortPassword = await request(app).post("/api/users").set(auth(adminToken)).send({
    name: "Short password", login: `short-${unique}`, password: "short", role: "VENDEDOR"
  });
  assert.equal(shortPassword.status, 400);

  const sellerLoginInput = `Api-Seller-${unique}`;
  const createdSeller = await request(app).post("/api/users").set(auth(adminToken)).send({
    name: `API test seller ${unique}`,
    login: sellerLoginInput,
    password: initialSellerPassword,
    role: "VENDEDOR"
  });
  assert.equal(createdSeller.status, 201);
  assert.equal(createdSeller.body.login, sellerLoginInput.toLowerCase());
  assert.equal("passwordHash" in createdSeller.body, false);
  assert.equal("password" in createdSeller.body, false);
  const sellerId = createdSeller.body.id as string;
  let sellerLogin = await login(sellerLoginInput, initialSellerPassword);
  assert.equal(sellerLogin.status, 200, "login accepts normalized casing");

  const sellerListDenied = await request(app).get("/api/users").set(auth(sellerLogin.body.token));
  assert.equal(sellerListDenied.status, 403);
  const sellerDetailDenied = await request(app).get(`/api/users/${admin.id}`).set(auth(sellerLogin.body.token));
  assert.equal(sellerDetailDenied.status, 403);
  const sellerCreateDenied = await request(app).post("/api/users").set(auth(sellerLogin.body.token)).send({
    name: "Forbidden", login: `forbidden-${unique}`, password: initialSellerPassword
  });
  assert.equal(sellerCreateDenied.status, 403);
  const sellerEditDenied = await request(app).patch(`/api/users/${admin.id}`).set(auth(sellerLogin.body.token)).send({ name: "Forbidden" });
  assert.equal(sellerEditDenied.status, 403);
  const sellerRoleEditDenied = await request(app).patch(`/api/users/${admin.id}`).set(auth(sellerLogin.body.token)).send({ role: "VENDEDOR" });
  assert.equal(sellerRoleEditDenied.status, 403);
  const sellerLoginEditDenied = await request(app).patch(`/api/users/${admin.id}`).set(auth(sellerLogin.body.token)).send({ login: `forbidden-${unique}` });
  assert.equal(sellerLoginEditDenied.status, 403);
  const sellerStatusDenied = await request(app).patch(`/api/users/${sellerId}/status`).set(auth(sellerLogin.body.token)).send({ active: false, reason: "forbidden" });
  assert.equal(sellerStatusDenied.status, 403);
  const sellerOtherStatusDenied = await request(app).patch(`/api/users/${admin.id}/status`).set(auth(sellerLogin.body.token)).send({ active: false, reason: "forbidden" });
  assert.equal(sellerOtherStatusDenied.status, 403);
  const sellerResetDenied = await request(app).post(`/api/users/${sellerId}/reset-password`).set(auth(sellerLogin.body.token)).send({ password: resetSellerPassword });
  assert.equal(sellerResetDenied.status, 403);
  const sellerBalanceCreateDenied = await request(app).post("/api/balances").set(auth(sellerLogin.body.token)).send({ name: "Forbidden" });
  assert.equal(sellerBalanceCreateDenied.status, 403);
  assert.equal((await request(app).post("/api/categories").set(auth(sellerLogin.body.token)).send({ name: `Forbidden ${unique}` })).status, 403);
  assert.equal((await request(app).post("/api/products").set(auth(sellerLogin.body.token)).send({})).status, 403);
  assert.equal((await request(app).post("/api/products/import/preview").set(auth(sellerLogin.body.token))).status, 403);

  const duplicateLogin = await request(app).post("/api/users").set(auth(adminToken)).send({
    name: "Duplicate", login: admin.login.toUpperCase(), password: initialSellerPassword
  });
  assert.equal(duplicateLogin.status, 409);
  assert.equal(duplicateLogin.body.error.code, "DUPLICATE_LOGIN");
  const duplicateEdit = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({ login: admin.login });
  assert.equal(duplicateEdit.status, 409);

  const noChange = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({});
  assert.equal(noChange.status, 400);
  const invalidRole = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({ role: "OWNER" });
  assert.equal(invalidRole.status, 400);
  const missingUser = await request(app).get(`/api/users/${crypto.randomUUID()}`).set(auth(adminToken));
  assert.equal(missingUser.status, 404);
  const missingEdit = await request(app).patch(`/api/users/${crypto.randomUUID()}`).set(auth(adminToken)).send({ name: "Nobody" });
  assert.equal(missingEdit.status, 404);

  for (const suffix of ["two", "three"]) {
    const paginatedUser = await request(app).post("/api/users").set(auth(adminToken)).send({
      name: `API test pagination ${suffix} ${unique}`,
      login: `api-${suffix}-${unique}`,
      password: initialSellerPassword,
      role: "VENDEDOR"
    });
    assert.equal(paginatedUser.status, 201);
  }

  const filtered = await request(app).get("/api/users").set(auth(adminToken)).query({
    q: unique,
    role: "VENDEDOR",
    active: "true",
    page: 1,
    limit: 1
  });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.total, 3);
  assert.equal(filtered.body.data.length, 1);
  assert.equal(filtered.body.page, 1);
  assert.equal(filtered.body.limit, 1);
  assert.equal("passwordHash" in filtered.body.data[0], false);
  const secondPage = await request(app).get("/api/users").set(auth(adminToken)).query({ q: unique, role: "VENDEDOR", active: "true", page: 2, limit: 1 });
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.total, 3);
  assert.notEqual(secondPage.body.data[0].id, filtered.body.data[0].id);
  const sellerDetail = await request(app).get(`/api/users/${sellerId}`).set(auth(adminToken));
  assert.equal(sellerDetail.status, 200);
  assert.equal("passwordHash" in sellerDetail.body, false);

  const reset = await request(app).post(`/api/users/${sellerId}/reset-password`).set(auth(adminToken)).send({ password: resetSellerPassword });
  assert.equal(reset.status, 204);
  assert.equal(reset.text, "");
  assert.equal((await request(app).get("/api/auth/me").set(auth(sellerLogin.body.token))).status, 401);
  assert.equal((await login(sellerLoginInput, initialSellerPassword)).status, 401);
  sellerLogin = await login(sellerLoginInput, resetSellerPassword);
  assert.equal(sellerLogin.status, 200);

  const wrongCurrentPassword = await request(app).post("/api/auth/change-password").set(auth(sellerLogin.body.token)).send({
    currentPassword: "wrong", newPassword: changedSellerPassword
  });
  assert.equal(wrongCurrentPassword.status, 400);
  const shortNewPassword = await request(app).post("/api/auth/change-password").set(auth(sellerLogin.body.token)).send({
    currentPassword: resetSellerPassword, newPassword: "short"
  });
  assert.equal(shortNewPassword.status, 400);
  const changedPassword = await request(app).post("/api/auth/change-password").set(auth(sellerLogin.body.token)).send({
    currentPassword: resetSellerPassword, newPassword: changedSellerPassword
  });
  assert.equal(changedPassword.status, 204);
  assert.equal((await request(app).get("/api/auth/me").set(auth(sellerLogin.body.token))).status, 401);
  assert.equal((await login(sellerLoginInput, resetSellerPassword)).status, 401);
  sellerLogin = await login(sellerLoginInput, changedSellerPassword);
  assert.equal(sellerLogin.status, 200);

  const changedLogin = `renamed-${unique}`;
  const edited = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({
    name: `Renamed seller ${unique}`,
    login: changedLogin
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.login, changedLogin);
  assert.equal((await request(app).get("/api/auth/me").set(auth(sellerLogin.body.token))).status, 401);
  assert.equal((await login(`api-seller-${unique}`, changedSellerPassword)).status, 401);
  const searchByLogin = await request(app).get("/api/users").set(auth(adminToken)).query({ q: changedLogin });
  assert.equal(searchByLogin.status, 200);
  assert.equal(searchByLogin.body.total, 1);
  const searchByName = await request(app).get("/api/users").set(auth(adminToken)).query({ q: `Renamed seller ${unique}` });
  assert.equal(searchByName.status, 200);
  assert.equal(searchByName.body.total, 1);
  sellerLogin = await login(changedLogin, changedSellerPassword);
  assert.equal(sellerLogin.status, 200);

  const elevatedRole = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({ role: "ADMIN" });
  assert.equal(elevatedRole.status, 200);
  assert.equal((await request(app).get("/api/auth/me").set(auth(sellerLogin.body.token))).status, 401);
  const elevatedLogin = await login(changedLogin, changedSellerPassword);
  assert.equal(elevatedLogin.status, 200);
  assert.equal(elevatedLogin.body.user.role, "ADMIN");
  const demotedRole = await request(app).patch(`/api/users/${sellerId}`).set(auth(adminToken)).send({ role: "VENDEDOR" });
  assert.equal(demotedRole.status, 200);
  assert.equal((await request(app).get("/api/auth/me").set(auth(elevatedLogin.body.token))).status, 401);

  const noStatusReason = await request(app).patch(`/api/users/${sellerId}/status`).set(auth(adminToken)).send({ active: false });
  assert.equal(noStatusReason.status, 400);
  const deactivated = await request(app).patch(`/api/users/${sellerId}/status`).set(auth(adminToken)).send({ active: false, reason: "API integration test" });
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.body.active, false);
  assert.equal((await request(app).get("/api/auth/me").set(auth(sellerLogin.body.token))).status, 401);
  assert.equal((await login(changedLogin, changedSellerPassword)).status, 401);
  const inactiveFilter = await request(app).get("/api/users").set(auth(adminToken)).query({ q: unique, active: "false" });
  assert.equal(inactiveFilter.status, 200);
  assert.equal(inactiveFilter.body.total, 1);
  const activated = await request(app).patch(`/api/users/${sellerId}/status`).set(auth(adminToken)).send({ active: true, reason: "API integration test" });
  assert.equal(activated.status, 200);
  sellerLogin = await login(changedLogin, changedSellerPassword);
  assert.equal(sellerLogin.status, 200);

  const category = await prisma.category.create({ data: { name: `API auth category ${unique}` } });
  const product = await prisma.product.create({ data: { internalCode: `AUTH-${unique}`, name: `API auth product ${unique}`, unit: "UN", categoryId: category.id } });
  const countedProduct = await prisma.product.create({ data: { internalCode: `AUTH-COUNTED-${unique}`, name: `API counted product ${unique}`, unit: "UN", categoryId: category.id } });
  const balance = await prisma.balance.create({ data: { name: `API auth balance ${unique}`, status: "ABERTO", createdById: admin.id, openedAt: new Date() } });
  const draftBalance = await prisma.balance.create({ data: { name: `API draft balance ${unique}`, status: "RASCUNHO", createdById: admin.id } });
  const pendingItem = await prisma.balanceItem.create({ data: { balanceId: balance.id, productId: product.id, referenceQuantity: "2" } });
  const countedItem = await prisma.balanceItem.create({ data: { balanceId: balance.id, productId: countedProduct.id, referenceQuantity: "4", status: "CONTADO" } });
  await prisma.count.create({ data: { balanceItemId: countedItem.id, userId: admin.id, quantity: "7", idempotencyKey: crypto.randomUUID() } });

  const sellerToken = sellerLogin.body.token as string;
  assert.equal((await request(app).get(`/api/products/${product.id}/qr-label`).set(auth(sellerToken))).status, 403);
  const sellerBalances = await request(app).get("/api/balances").set(auth(sellerToken));
  assert.equal(sellerBalances.status, 200);
  assert.ok(sellerBalances.body.data.some((entry: { id: string }) => entry.id === balance.id));
  assert.ok(!sellerBalances.body.data.some((entry: { id: string }) => entry.id === draftBalance.id), "seller must not see draft balances");
  assert.equal((await request(app).get(`/api/balances/${draftBalance.id}/items`).set(auth(sellerToken))).body.data.length, 0, "seller must not see items in a draft balance");
  const sellerItems = await request(app).get(`/api/balances/${balance.id}/items`).query({ status: "CONTADO" }).set(auth(sellerToken));
  assert.equal(sellerItems.status, 200);
  assert.equal(sellerItems.body.data.length, 1);
  assert.deepEqual(sellerItems.body.data[0].counts, [], "seller must not see another user's count");
  const adminItems = await request(app).get(`/api/balances/${balance.id}/items`).query({ status: "CONTADO" }).set(auth(adminToken));
  assert.equal(adminItems.body.data[0].counts[0].countedBy.id, admin.id);
  const postedCount = await request(app).post(`/api/balances/${balance.id}/items/${pendingItem.id}/counts`).set(auth(sellerToken)).set("Idempotency-Key", crypto.randomUUID()).send({ quantity: "5", userId: admin.id });
  assert.equal(postedCount.status, 201);
  const persistedCount = await prisma.count.findUniqueOrThrow({ where: { id: postedCount.body.id } });
  assert.equal(persistedCount.userId, sellerId, "count author must come from the authenticated seller token");
  const adminCountDenied = await request(app).post(`/api/balances/${balance.id}/items/${pendingItem.id}/counts`).set(auth(adminToken)).set("Idempotency-Key", crypto.randomUUID()).send({ quantity: "6" });
  assert.equal(adminCountDenied.status, 403);

  const resetMissing = await request(app).post(`/api/users/${crypto.randomUUID()}/reset-password`).set(auth(adminToken)).send({ password: resetSellerPassword });
  assert.equal(resetMissing.status, 404);

  const secondAdmin = await request(app).post("/api/users").set(auth(adminToken)).send({
    name: `API test second admin ${unique}`,
    login: `api-admin-second-${unique}`,
    password: adminPassword,
    role: "ADMIN"
  });
  assert.equal(secondAdmin.status, 201);
  let secondAdminLogin = await login(secondAdmin.body.login, adminPassword);
  assert.equal(secondAdminLogin.status, 200);

  const concurrentChanges = await Promise.all([
    request(app).patch(`/api/users/${admin.id}`).set(auth(adminToken)).send({ role: "VENDEDOR" }),
    request(app).patch(`/api/users/${secondAdmin.body.id}/status`).set(auth(secondAdminLogin.body.token)).send({ active: false, reason: "concurrency test" })
  ]);
  assert.ok(concurrentChanges.every((result) => [200, 403, 409].includes(result.status)));
  const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  assert.equal(activeAdminCount, 1, "concurrent admin changes must preserve one active admin");
  const remainingAdmin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", active: true } });
  const remainingLogin = await login(remainingAdmin.login, adminPassword);
  assert.equal(remainingLogin.status, 200);
  const lastAdminDeactivation = await request(app).patch(`/api/users/${remainingAdmin.id}/status`).set(auth(remainingLogin.body.token)).send({ active: false, reason: "last admin test" });
  assert.equal(lastAdminDeactivation.status, 409);
  const lastAdminDemotion = await request(app).patch(`/api/users/${remainingAdmin.id}`).set(auth(remainingLogin.body.token)).send({ role: "VENDEDOR" });
  assert.equal(lastAdminDemotion.status, 409);

  const auditActions = await prisma.audit.findMany({
    where: { objectType: "USER", objectId: sellerId },
    select: { action: true }
  });
  for (const action of ["USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED", "USER_ACTIVATED", "USER_PASSWORD_RESET", "USER_PASSWORD_CHANGED"]) {
    assert.ok(auditActions.some((entry) => entry.action === action), `missing audit action ${action}`);
  }
  const storedSeller = await prisma.user.findUniqueOrThrow({ where: { id: sellerId } });
  assert.notEqual(storedSeller.passwordHash, changedSellerPassword);
  assert.equal(await bcrypt.compare(changedSellerPassword, storedSeller.passwordHash), true);
  console.log("PASS: user API and seller auth, missing/tampered/expired/inactive sessions, ADMIN restrictions, seller balance/count scope, authenticated count authorship, validation, audit and concurrency");
} finally {
  await prisma.$disconnect();
}
