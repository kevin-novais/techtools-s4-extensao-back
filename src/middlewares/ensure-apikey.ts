import { Request, Response, NextFunction } from "express";
import AppError from "@/util/AppError";
import { Config } from "@/config/config";
import log from "@/util/logger";

const extractBearerToken = (authHeader: string | string[] | undefined): string | undefined => {
  if (!authHeader || typeof authHeader !== "string") {
    return undefined;
  }
  if (!authHeader.startsWith("Bearer ")) {
    return undefined;
  }
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : undefined;
};

export const ensureApiKey = (req: Request, _: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const apiKey = extractBearerToken(authHeader);
  const expectedApiKey = Config.APP_API_KEY;

  if (!expectedApiKey) {
    log.error({
      message: "API key not configured",
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    });
    throw new AppError("Internal server error", 500);
  }

  if (!apiKey) {
    log.error({
      message: "API key not provided",
      request: {
        authorizationProvided: !!authHeader,
        ip: req.ip,
        "user-agent": req.headers["user-agent"],
      },
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    });
    throw new AppError("Unauthorized", 401);
  }

  if (apiKey !== expectedApiKey) {
    log.warn({
      message: "Invalid API key",
      request: {
        authorizationProvided: true,
        ip: req.ip,
        "user-agent": req.headers["user-agent"],
      },
      timestamp: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    });
    throw new AppError("Unauthorized", 401);
  }

  next();
};
