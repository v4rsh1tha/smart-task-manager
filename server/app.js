require("express-async-errors"); // lets async route errors reach the error handler
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");

const app = express();
app.set("trust proxy", 1); // we run behind Nginx, so use the real client IP
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? "ok" : "database unavailable" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api", (req, res) => res.status(404).json({ message: "Route not found" }));

// Last stop for any error, so the server never crashes on a bad request.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }
  if (err.name === "CastError") return res.status(404).json({ message: "Not found" });
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server" });
});

module.exports = app;
