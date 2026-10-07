import { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import log from "@/util/logger";
import AppError from "@/util/AppError";
import { ZodError } from "zod";

export const errorHandling: ErrorRequestHandler = (
  error,
  req: Request,
  res: Response,
  next: NextFunction
) => {


  if (error instanceof AppError) {
    log.error("[HTTP] AppError: %s", error.message, {
      path: req.originalUrl,
      method: req.method,
      statusCode: error.statusCode,
    });
    return res.status(error.statusCode).json({
      success: false,
      status: "error",
      message: error.message
    });
  }

  if (error instanceof ZodError) {
    log.error("[HTTP] ZodError", {
      path: req.originalUrl,
      method: req.method,
      issues: error.issues,
    });
    return res.status(400).json({
      success: false,
      status: "error",
      message: "Validation error",
      issues: error.format()
    });
  }

  log.error("[HTTP] Internal server error: %o", error, {
    path: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    status: "error",
    message: "Internal server error"
  });
}
