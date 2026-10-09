// Shared test setup. Replaces the database models with small in-memory fakes,
// so the tests run anywhere without MongoDB.
process.env.JWT_SECRET = "test_secret_value_123456";

const users = [];
const tasks = [];

const FakeUser = {
  async findOne(q) { return users.find((u) => u.email === q.email) || null; },
  async create(d) { const u = { _id: "u" + (users.length + 1), role: "user", ...d }; users.push(u); return u; },
  findById(id) { const u = users.find((x) => x._id === id) || null; return { select: async () => u }; },
};

function query(list) {
  let rows = list;
  const q = {
    populate() {
      rows = rows.map((t) => {
        const o = users.find((u) => u._id === t.owner);
        return { ...t, owner: { _id: t.owner, name: o ? o.name : "Unknown" } };
      });
      return q;
    },
    sort() { return q; },
    then(res, rej) { return Promise.resolve(rows).then(res, rej); },
  };
  return q;
}

const FakeTask = {
  find(filter) { return query(filter.owner ? tasks.filter((t) => t.owner === filter.owner) : tasks); },
  async findById(id) {
    const t = tasks.find((x) => x._id === id);
    if (!t) return null;
    t.save = async () => t;
    t.deleteOne = async () => { tasks.splice(tasks.indexOf(t), 1); };
    return t;
  },
  async create(d) {
    const t = { _id: "t" + (tasks.length + 1), done: false, priority: "medium", ...d };
    Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
    if (!t.priority) t.priority = "medium";
    tasks.push(t);
    return t;
  },
};

function stub(modulePath, exports) {
  const p = require.resolve(modulePath);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
}
stub("../models/User", FakeUser);
stub("../models/Task", FakeTask);

const app = require("../app");

function start() {
  return new Promise((resolve) => {
    const server = app.listen(0, () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

async function call(base, method, url, { body, token } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

module.exports = { users, tasks, start, call };
