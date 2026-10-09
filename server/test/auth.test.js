const test = require("node:test");
const assert = require("node:assert/strict");
const { start, call } = require("./helpers");

let server, base, token;
test.before(async () => ({ server, base } = await start()));
test.after(() => server.close());

const good = { name: "Asha Rao", email: "Asha@Example.com", password: "Passw0rdOK" };

test("register rejects a weak password with a field error", async () => {
  const r = await call(base, "POST", "/api/auth/register", { body: { ...good, password: "weak" } });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.password);
});

test("register rejects a bad email", async () => {
  const r = await call(base, "POST", "/api/auth/register", { body: { ...good, email: "nope" } });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.email);
});

test("register rejects a missing name", async () => {
  const r = await call(base, "POST", "/api/auth/register", { body: { ...good, name: " " } });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.name);
});

test("register creates the account and returns a token (no password leaked)", async () => {
  const r = await call(base, "POST", "/api/auth/register", { body: good });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.equal(r.body.user.email, "asha@example.com");
  assert.equal(r.body.user.role, "user");
  assert.equal(r.body.user.password, undefined);
});

test("register blocks a duplicate email", async () => {
  const r = await call(base, "POST", "/api/auth/register", { body: good });
  assert.equal(r.status, 409);
  assert.ok(r.body.errors.email);
});

test("login gives the same message for a wrong password and an unknown email", async () => {
  const a = await call(base, "POST", "/api/auth/login", { body: { email: good.email, password: "WrongPass1" } });
  const b = await call(base, "POST", "/api/auth/login", { body: { email: "ghost@example.com", password: "WrongPass1" } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.message, b.body.message);
});

test("login asks for both fields", async () => {
  const r = await call(base, "POST", "/api/auth/login", { body: { email: good.email } });
  assert.equal(r.status, 400);
});

test("login works with the right details (email is case-insensitive)", async () => {
  const r = await call(base, "POST", "/api/auth/login", { body: { email: "ASHA@example.com", password: good.password } });
  assert.equal(r.status, 200);
  token = r.body.token;
  assert.ok(token);
});

test("/me accepts a valid token and rejects a missing or fake one", async () => {
  const ok = await call(base, "GET", "/api/auth/me", { token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.name, "Asha Rao");
  assert.equal((await call(base, "GET", "/api/auth/me")).status, 401);
  assert.equal((await call(base, "GET", "/api/auth/me", { token: "fake.token.value" })).status, 401);
});

test("bad JSON gets a clean 400, not a crash", async () => {
  const r = await call(base, "POST", "/api/auth/login", { body: "{oops" });
  assert.equal(r.status, 400);
});

test("health check and unknown routes respond cleanly", async () => {
  assert.equal((await call(base, "GET", "/api/health")).status, 503); // no database in tests
  assert.equal((await call(base, "GET", "/api/nothing")).status, 404);
});
