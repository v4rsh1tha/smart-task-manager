import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Tasks from "./Tasks.jsx";

const ok = (data, status = 200) => ({ ok: true, status, json: async () => data });
const seed = () => [
  { _id: "1", title: "Write report", done: false, priority: "high", owner: { name: "Asha" } },
  { _id: "2", title: "Book server", done: true, priority: "low", owner: { name: "Ravi" } },
];

// A tiny fake API that remembers changes, like the real server would.
function fakeApi(initial) {
  let list = [...initial];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method || "GET";
    const id = url.split("/")[3];
    if (method === "GET") return ok(list);
    if (method === "POST") {
      const b = JSON.parse(opts.body);
      list = [{ _id: "9", title: b.title, done: false, priority: b.priority, owner: { name: "Asha" } }, ...list];
      return ok(list[0], 201);
    }
    if (method === "PUT") {
      const b = JSON.parse(opts.body);
      list = list.map((t) => (t._id === id ? { ...t, ...b } : t));
      return ok(list.find((t) => t._id === id));
    }
    list = list.filter((t) => t._id !== id);
    return ok({ message: "Task deleted" });
  });
}

const session = (role = "user") => ({ token: "t", user: { name: "Asha", role } });
afterEach(() => vi.restoreAllMocks());

test("shows tasks and the summary numbers", async () => {
  fakeApi(seed());
  render(<Tasks session={session()} onLogout={() => {}} />);
  expect(await screen.findByText("Write report")).toBeInTheDocument();
  expect(within(screen.getByTestId("stat-open")).getByText("1")).toBeInTheDocument();
  expect(within(screen.getByTestId("stat-done")).getByText("1")).toBeInTheDocument();
  expect(within(screen.getByTestId("stat-total")).getByText("2")).toBeInTheDocument();
});

test("open tasks are listed before completed ones", async () => {
  fakeApi([seed()[1], seed()[0]]); // completed task arrives first
  render(<Tasks session={session()} onLogout={() => {}} />);
  await screen.findByText("Write report");
  const titles = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(titles[0]).toContain("Write report");
  expect(titles[1]).toContain("Book server");
});

test("shows a friendly message when there are no tasks", async () => {
  fakeApi([]);
  render(<Tasks session={session()} onLogout={() => {}} />);
  expect(await screen.findByText("No tasks yet")).toBeInTheDocument();
});

test("adding a task sends it to the server and shows it", async () => {
  fakeApi([]);
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={() => {}} />);
  await screen.findByText("No tasks yet");
  await user.type(screen.getByLabelText("Task title"), "Prepare for interview");
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(await screen.findByText("Prepare for interview")).toBeInTheDocument();
  const post = global.fetch.mock.calls.find(([, o]) => o?.method === "POST");
  expect(JSON.parse(post[1].body)).toEqual({ title: "Prepare for interview", priority: "high" });
});

test("an empty title is not sent", async () => {
  fakeApi([]);
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={() => {}} />);
  await screen.findByText("No tasks yet");
  await user.click(screen.getByRole("button", { name: "Add task" }));
  expect(global.fetch.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
});

test("ticking a task marks it done on the server", async () => {
  fakeApi(seed());
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={() => {}} />);
  await user.click(await screen.findByLabelText('Mark "Write report" as done'));
  await waitFor(() => expect(within(screen.getByTestId("stat-done")).getByText("2")).toBeInTheDocument());
  const put = global.fetch.mock.calls.find(([, o]) => o?.method === "PUT");
  expect(JSON.parse(put[1].body)).toEqual({ done: true });
});

test("a rejected change is undone and the error is shown", async () => {
  fakeApi(seed());
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={() => {}} />);
  const box = await screen.findByLabelText('Mark "Write report" as done');
  const real = global.fetch;
  global.fetch = vi.fn(async (url, opts = {}) =>
    opts.method === "PUT"
      ? { ok: false, status: 403, json: async () => ({ message: "Not your task" }) }
      : real(url, opts)
  );
  await user.click(box);
  expect(await screen.findByRole("alert")).toHaveTextContent("Not your task");
  expect(screen.getByLabelText('Mark "Write report" as done')).not.toBeChecked();
});

test("deleting removes the task", async () => {
  fakeApi(seed());
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={() => {}} />);
  await user.click(await screen.findByRole("button", { name: 'Delete "Write report"' }));
  await waitFor(() => expect(screen.queryByText("Write report")).not.toBeInTheDocument());
});

test("admins see everyone's tasks with the owner's name", async () => {
  fakeApi(seed());
  render(<Tasks session={session("admin")} onLogout={() => {}} />);
  expect(await screen.findByRole("heading", { name: "All tasks" })).toBeInTheDocument();
  expect(screen.getByText("Ravi")).toBeInTheDocument();
});

test("normal users don't see owner names", async () => {
  fakeApi(seed());
  render(<Tasks session={session()} onLogout={() => {}} />);
  await screen.findByText("Write report");
  expect(screen.queryByText("Ravi")).not.toBeInTheDocument();
});

test("sign out calls onLogout", async () => {
  fakeApi([]);
  const onLogout = vi.fn();
  const user = userEvent.setup();
  render(<Tasks session={session()} onLogout={onLogout} />);
  await user.click(await screen.findByRole("button", { name: "Sign out" }));
  expect(onLogout).toHaveBeenCalled();
});
