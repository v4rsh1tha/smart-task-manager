const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true, // only failed logins count
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many failed attempts. Try again in 15 minutes." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-ups from this network. Try again later." },
});

const signToken = (user, remember) =>
  jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: remember ? "7d" : "1d",
  });

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });

function validateRegister({ name, email, password }) {
  const errors = {};
  if (typeof name !== "string" || name.trim().length < 2) errors.name = "Enter your full name.";
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    errors.password = "Use 8+ characters with an uppercase letter, a lowercase letter, and a number.";
  }
  return errors;
}

// POST /api/auth/register -> creates the account and signs the person in
router.post("/register", registerLimiter, async (req, res) => {
  const errors = validateRegister(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Fix the highlighted fields.", errors });
  }
  const email = req.body.email.trim().toLowerCase();
  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({
      message: "That email is already registered.",
      errors: { email: "That email is already registered. Try signing in." },
    });
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  let user;
  try {
    user = await User.create({ name: req.body.name.trim(), email, password: hash });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "That email is already registered.",
        errors: { email: "That email is already registered. Try signing in." },
      });
    }
    throw err;
  }
  res.status(201).json({ token: signToken(user, !!req.body.remember), user: publicUser(user) });
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ message: "Enter your email and password." });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) {
    // One message for both cases, so nobody can probe which emails exist.
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  res.json({ token: signToken(user, !!remember), user: publicUser(user) });
});

// GET /api/auth/me -> lets the app check a saved token is still valid
router.get("/me", authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(401).json({ message: "Account no longer exists" });
  res.json({ user: publicUser(user) });
});

module.exports = router;
