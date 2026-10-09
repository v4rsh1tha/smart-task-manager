const express = require("express");
const Task = require("../models/Task");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate); // every task route needs a valid token

const PRIORITIES = ["low", "medium", "high"];
const canChange = (task, user) => task.owner.toString() === user.id || user.role === "admin";

function check(body, partial) {
  const errors = {};
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) errors.title = "Enter a task title.";
    else if (body.title.trim().length > 120) errors.title = "Keep the title under 120 characters.";
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    errors.priority = "Priority must be low, medium or high.";
  }
  if (body.done !== undefined && typeof body.done !== "boolean") {
    errors.done = "Done must be true or false.";
  }
  return errors;
}
const reject = (res, errors) => res.status(400).json({ message: Object.values(errors)[0], errors });

// GET /api/tasks -> users see their own tasks, admins see everyone's
router.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { owner: req.user.id };
  const tasks = await Task.find(filter).populate("owner", "name").sort({ createdAt: -1 });
  res.json(tasks);
});

// POST /api/tasks
router.post("/", async (req, res) => {
  const body = req.body || {};
  const errors = check(body, false);
  if (Object.keys(errors).length) return reject(res, errors);
  const task = await Task.create({
    title: body.title.trim(),
    priority: body.priority,
    owner: req.user.id,
  });
  res.status(201).json(task);
});

// PUT /api/tasks/:id -> owner or admin
router.put("/:id", async (req, res) => {
  const body = req.body || {};
  const errors = check(body, true);
  if (Object.keys(errors).length) return reject(res, errors);
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canChange(task, req.user)) return res.status(403).json({ message: "Not your task" });
  if (body.title !== undefined) task.title = body.title.trim();
  if (body.priority !== undefined) task.priority = body.priority;
  if (body.done !== undefined) task.done = body.done;
  await task.save();
  res.json(task);
});

// DELETE /api/tasks/:id -> owner or admin
router.delete("/:id", async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canChange(task, req.user)) return res.status(403).json({ message: "Not your task" });
  await task.deleteOne();
  res.json({ message: "Task deleted" });
});

module.exports = router;
