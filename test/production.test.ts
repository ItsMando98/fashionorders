import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dbFile = path.join(os.tmpdir(), `fashion-orders-test-${process.pid}.db`);
process.env.FASHION_ORDERS_DB = dbFile;

test("email addresses are normalized before a login code is sent", async () => {
  const { normalizeEmail, createLoginCode } = await import("../src/lib/server/email");
  assert.equal(normalizeEmail("  Ada@Example.com "), "ada@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.match(createLoginCode(), /^\d{6}$/);
});

test("password hashes upgrade from the old fast hash", async () => {
  const { hashPassword, verifyPassword } = await import("../src/lib/server/passwords");
  const legacy = crypto.createHash("sha256").update("fashionorders_salt_1234").digest("hex");
  const oldCheck = verifyPassword(legacy, "1234");
  assert.equal(oldCheck.ok, true);
  assert.equal(oldCheck.needsUpgrade, true);

  const fresh = hashPassword("longpassword");
  assert.equal(verifyPassword(fresh, "longpassword").ok, true);
  assert.equal(verifyPassword(fresh, "wrong-password").ok, false);
  assert.equal(verifyPassword(fresh, "wrong-password").needsUpgrade, false);
});

test("shop host checks reject lookalike and private addresses", async () => {
  const hosts = await import("../src/lib/server/hosts");
  assert.equal(hosts.isAllowedShopHost("yupoo.com"), true);
  assert.equal(hosts.isAllowedShopHost("photo.yupoo.com"), true);
  assert.equal(hosts.isAllowedShopHost("yupoo.com.evil.example"), false);
  assert.equal(hosts.isAllowedShopHost("notyupoo.com"), false);
  assert.equal(hosts.isAllowedImageHost("si.geilicdn.com"), true);
  assert.equal(hosts.isPrivateAddress("127.0.0.1"), true);
  assert.equal(hosts.isPrivateAddress("10.1.4.147"), true);
  assert.equal(hosts.isPrivateAddress("8.8.8.8"), false);
});

test("rate limit blocks the next attempt after the cap", async () => {
  const { rateLimit, resetRateLimits } = await import("../src/lib/server/rate-limit");
  resetRateLimits();
  assert.equal(rateLimit("test-key", 2, 60_000).ok, true);
  assert.equal(rateLimit("test-key", 2, 60_000).ok, true);
  assert.equal(rateLimit("test-key", 2, 60_000).ok, false);
});

test("signup cannot become admin by choosing a name", async () => {
  const { POST } = await import("../src/app/api/auth/signup/route");
  const response = await POST(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mathis", password: "longpassword" }),
    })
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.role, "friend");
  assert.equal(body.token, undefined);
  assert.match(response.headers.get("set-cookie") || "", /fo_session=/);
});

test("unknown login and a friend hitting admin get no extra access", async () => {
  const { POST: login } = await import("../src/app/api/auth/login/route");
  const missing = await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "nobody-here", password: "longpassword" }),
    })
  );
  const wrong = await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mathis", password: "not-the-password" }),
    })
  );
  const missingBody = await missing.json();
  const wrongBody = await wrong.json();
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(missingBody.detail, wrongBody.detail);

  const { POST: signup } = await import("../src/app/api/auth/signup/route");
  const created = await signup(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ name: "Friend One", password: "longpassword" }),
    })
  );
  const cookie = created.headers.get("set-cookie") || "";
  const { POST: status } = await import("../src/app/api/admin/users/[id]/status/route");
  const denied = await status(
    new Request("http://localhost/api/admin/users/1/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ disabled: 1 }),
    }),
    { params: Promise.resolve({ id: "1" }) }
  );
  assert.equal(denied.status, 403);
});

test.after(() => {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(`${dbFile}${suffix}`, { force: true });
  }
});
