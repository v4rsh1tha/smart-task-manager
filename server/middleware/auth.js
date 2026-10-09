const jwt = require("jsonwebtoken");

// Checks the token sent in the "Authorization: Bearer <token>" header.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Allows only the listed roles, e.g. authorize("admin").
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
