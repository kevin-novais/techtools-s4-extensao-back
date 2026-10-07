import jwt from "jsonwebtoken";
import { Config } from "../../../src/config/config";

interface TestTokenPayload {
    id: number;
    perfil?: "USER" | "ADMIN";
}

export function signTestToken({ id, perfil = "ADMIN" }: TestTokenPayload): string {
    return jwt.sign({ id, perfil }, Config.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
    });
}
