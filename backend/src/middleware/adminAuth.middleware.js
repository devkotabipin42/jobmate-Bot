import { env } from "../config/env.js";

export function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token || token !== env.ADMIN_AUTH_TOKEN) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized admin request",
    });
  }

  next();
}
