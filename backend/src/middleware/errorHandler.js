import { env } from "../config/env.js";

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Route ${req.originalUrl} not found`,
    },
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  const response = {
    success: false,
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "Something went wrong",
    },
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (env.NODE_ENV === "development") {
    response.error.stack = error.stack;
  }

  console.error("❌ API Error:", {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: error.message,
    code: error.code,
  });

  res.status(statusCode).json(response);
}