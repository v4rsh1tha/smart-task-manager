import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function Tasks({ session, onLogout }) {
  const { token, user } = session;
  const isAdmin = user.role === "admin";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      setTasks(await api("/tasks", { token }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function addTask(e) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    setAdding(true);
    try {
      await api("/tasks", { method: "POST", token, body: { title: text, priority } });
      setTitle("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggle(task) {
    const before = tasks;
    setTasks(tasks.map((t) => (t._id === task._id ? { ...t, done: !t.done } : t))); // instant
    try {
      await api(`/tasks/${task._id}`, { method: "PUT", token, body: { done: !task.done } });
    } catch (err) {
      setTasks(before); // undo if the server said no
      setError(err.message);
    }
  }

  async function remove(task) {
    try {
      await api(`/tasks/${task._id}`, { method: "DELETE", token });
      setTasks(tasks.filter((t) => t._id !== task._id));
    } catch (err) {
      setError(err.message);
    }
  }

  const open = tasks.filter((t) => !t.done);
  const finished = tasks.filter((t) => t.done);
  const ordered = [...open, ...finished]; // open tasks first

  return (
    <div className="shell">
      <header className="topbar">
        <p className="brand dark">Smart Task Manager</p>
        <div className="who">
          <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="who-name">{user.name}</span>
          <span className={`role ${user.role}`}>{user.role}</span>
          <button className="btn ghost" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main className="content">
        <div className="page-head">
          <h1>{isAdmin ? "All tasks" : "Your tasks"}</h1>
          <p>{isAdmin ? "You're an admin, so you can see and manage everyone's tasks." : "Add what needs doing, then tick it off."}</p>
        </div>

        <section className="stats" aria-label="Task summary">
          <div className="stat" data-testid="stat-open">
            <span className="stat-label">Open</span>
            <span className="stat-value">{open.length}</span>
          </div>
          <div className="stat" data-testid="stat-done">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{finished.length}</span>
          </div>
          <div className="stat" data-testid="stat-total">
            <span className="stat-label">Total</span>
            <span className="stat-value">{tasks.length}</span>
          </div>
        </section>

        <form className="add" onSubmit={addTask}>
          <input
            aria-label="Task title"
            placeholder="What needs doing?"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button className="btn primary" type="submit" disabled={adding}>Add task</button>
        </form>

        {error && <p className="error banner" role="alert">{error}</p>}

        {loading ? (
          <p className="empty">Loading your tasks…</p>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <h2>No tasks yet</h2>
            <p>Type a task above and press Add task to get started.</p>
          </div>
        ) : (
          <ul className="task-list">
            {ordered.map((t) => (
              <li key={t._id} className={`task ${t.done ? "is-done" : ""}`}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggle(t)}
                  aria-label={`Mark "${t.title}" as ${t.done ? "not done" : "done"}`}
                />
                <span className="task-title">{t.title}</span>
                <span className={`prio ${t.priority}`}>{t.priority}</span>
                {isAdmin && t.owner?.name && <span className="owner">{t.owner.name}</span>}
                <button className="btn ghost small" onClick={() => remove(t)} aria-label={`Delete "${t.title}"`}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
