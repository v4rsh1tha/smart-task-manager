const test = require("node:test");
const assert = require("node:assert/strict");
const { users, start, call } = require("./helpers");

let server, base;
const tokens = {};
let ashaTaskId;

async function signUp(name, email) {
  await call(base, "POST", "/api/auth/register", { body: { name, email, password: "Passw0rdOK" } });
}
async function signIn(key, email) {
  const r = await call(base, "POST", "/api/auth/login", { body: { email, password: "Passw0rdOK" } });
  tokens[key] = r.body.token;
}

test.before(async () => {
  ({ server, base } = await start());
  await signUp("Asha", "asha@example.com");
  await signUp("Ravi", "ravi@example.com");
  await signUp("Admin", "admin@example.com");
  users.find((u) => u.email === "admin@example.com").role = "admin"; // promote
  await signIn("asha", "asha@example.com");
  await signIn("ravi", "ravi@example.com");
  await signIn("admin", "admin@example.com");
});
test.after(() => server.close());

test("every task route needs a token", async () => {
  assert.equal((await call(base, "GET", "/api/tasks")).status, 401);
  assert.equal((await call(base, "POST", "/api/tasks", { body: { title: "x" } })).status, 401);
});

test("create a task (priority defaults to medium)", async () => {
  const r = await call(base, "POST", "/api/tasks", { token: tokens.asha, body: { title: "  Write report  " } });
  assert.equal(r.status, 201);
  assert.equal(r.body.title, "Write report");
  assert.equal(r.body.priority, "medium");
  assert.equal(r.body.done, false);
  ashaTaskId = r.body._id;
});

test("create rejects an empty title, a long title and a bad priority", async () => {
  const t = tokens.asha;
  assert.equal((await call(base, "POST", "/api/tasks", { token: t, body: { title: "  " } })).status, 400);
  assert.equal((await call(base, "POST", "/api/tasks", { token: t, body: { title: "x".repeat(121) } })).status, 400);
  assert.equal((await call(base, "POST", "/api/tasks", { token: t, body: { title: "ok", priority: "urgent" } })).status, 400);
});

test("a user sees only their own tasks", async () => {
  const asha = await call(base, "GET", "/api/tasks", { token: tokens.asha });
  const ravi = await call(base, "GET", "/api/tasks", { token: tokens.ravi });
  assert.equal(asha.body.length, 1);
  assert.equal(ravi.body.length, 0);
});

test("another user cannot change or delete someone else's task", async () => {
  const put = await call(base, "PUT", `/api/tasks/${ashaTaskId}`, { token: tokens.ravi, body: { done: true } });
  const del = await call(base, "DELETE", `/api/tasks/${ashaTaskId}`, { token: tokens.ravi });
  assert.equal(put.status, 403);
  assert.equal(del.status, 403);
});

test("the owner can mark a task done and change its priority", async () => {
  const r = await call(base, "PUT", `/api/tasks/${ashaTaskId}`, { token: tokens.asha, body: { done: true, priority: "high" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.done, true);
  assert.equal(r.body.priority, "high");
});

test("update rejects invalid values", async () => {
  const r = await call(base, "PUT", `/api/tasks/${ashaTaskId}`, { token: tokens.asha, body: { done: "yes" } });
  assert.equal(r.status, 400);
});

test("an admin sees every task, with the owner's name", async () => {
  const r = await call(base, "GET", "/api/tasks", { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].owner.name, "Asha");
});

test("an unknown task returns 404", async () => {
  assert.equal((await call(base, "PUT", "/api/tasks/nope", { token: tokens.asha, body: { done: true } })).status, 404);
  assert.equal((await call(base, "DELETE", "/api/tasks/nope", { token: tokens.asha })).status, 404);
});

test("an admin can delete any task", async () => {
  const r = await call(base, "DELETE", `/api/tasks/${ashaTaskId}`, { token: tokens.admin });
  assert.equal(r.status, 200);
  assert.equal((await call(base, "GET", "/api/tasks", { token: tokens.asha })).body.length, 0);
});
