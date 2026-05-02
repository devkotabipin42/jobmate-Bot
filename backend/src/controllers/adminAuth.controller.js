import { env } from "../config/env.js";

export async function adminLogin(req, res) {
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({
      success: false,
      message: "Password is required",
    });
  }

  if (password !== env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin password",
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      token: env.ADMIN_AUTH_TOKEN,
      user: {
        name: "Admin",
        role: "admin",
      },
    },
  });
}
