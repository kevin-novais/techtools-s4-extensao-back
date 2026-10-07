import crypto from "node:crypto";
import { Config } from "@/config/config";

const ALGORITMO = "aes-256-gcm";
const KEY = Buffer.from(Config.ENCRYPTION_KEY, "base64"); // 32 bytes base64 (256 bits)

export function encryptString(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // concat iv + tag + data em base64 (pra ficar em um único campo do DB)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptString(cipherText: string) {
  const buf = Buffer.from(cipherText, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITMO, KEY, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
