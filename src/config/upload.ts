import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import AppError from "@/util/AppError";
import { Config } from "@/config/config";

const TMP_FOLDER = path.resolve(__dirname, "..", "..", "tmp");
const STORAGE_FOLDER = Config.BASE_STORAGE_FOLDER;
const UPLOADS_STORAGE_FOLDER = path.resolve(STORAGE_FOLDER, "uploads");
const AVATARS_STORAGE_FOLDER = path.resolve(STORAGE_FOLDER, "avatars");
const PLANILHAS_STORAGE_FOLDER = path.resolve(STORAGE_FOLDER, "planilhas");
const RELATORIOS_STORAGE_FOLDER = path.resolve(STORAGE_FOLDER, "relatorios");

const MAX_FILE_SIZE = 1024 * 1024 * Config.MAX_FILE_SIZE_MB;

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg",
  "video/mp4",
  "video/mpeg",
  "audio/ogg",
  "audio/mp3",
  "application/pdf",
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ACCEPTED_AVATAR_TYPES = [
  "jpeg",
  "png",
  "jpg",
  "webp",
];

const ACCEPTED_XLSX_TYPES = [
  "xlsx",
];


function isValidAvatar(avatarUrl: string): boolean {
  return ACCEPTED_AVATAR_TYPES.includes(avatarUrl.split(".").pop() ?? "");
}

function isValidXlsx(filename: string): boolean {
  return ACCEPTED_XLSX_TYPES.includes(filename.split(".").pop() ?? "");
}



export function sanitizeFilename(filename: string): string {
  return filename
    // Remove acentos e caracteres especiais
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    // Remove caracteres especiais, mantém apenas letras, números, pontos, hífens e underscores
    .replaceAll(/[^a-zA-Z0-9.\-_]/g, '_')
    // Remove múltiplos underscores consecutivos
    .replaceAll(/_+/g, '_')
    // Remove underscores no início e fim
    .replaceAll(/(^_+)|(_+$)/g, '')
    // Remove pontos múltiplos consecutivos
    .replaceAll(/\.{2,}/g, '.')
    // Garante que não comece com ponto
    .replace(/^\./, '');
}


const MULTER = {
  storage: multer.diskStorage({
    destination: TMP_FOLDER,
    filename: (req, file, cb) => {
      const fileHash = crypto.randomBytes(10).toString("hex");
      const sanitizedName = sanitizeFilename(file.originalname.trim());
      const filename = `${fileHash}-${sanitizedName}`;
      return cb(null, filename);
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.mimetype)) {
      return cb(new AppError("Tipo de arquivo inválido", 400));
    }
    cb(null, true);
  }
}

const MULTER_XLSX = {
  storage: multer.diskStorage({
    destination: TMP_FOLDER,
    filename: (req, file, cb) => {
      const fileHash = crypto.randomBytes(10).toString("hex");
      const sanitizedName = sanitizeFilename(file.originalname.trim());
      const filename = `${fileHash}-${sanitizedName}`;
      return cb(null, filename);
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return cb(new AppError("Tipo de arquivo inválido. Apenas arquivos .xlsx são aceitos", 400));
    }
    cb(null, true);
  }
}


export default {
  MULTER,
  MULTER_XLSX,
  TMP_FOLDER,
  STORAGE_FOLDER,
  UPLOADS_STORAGE_FOLDER,
  AVATARS_STORAGE_FOLDER,
  PLANILHAS_STORAGE_FOLDER,
  RELATORIOS_STORAGE_FOLDER,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
  ACCEPTED_AVATAR_TYPES,
  ACCEPTED_XLSX_TYPES,
  isValidAvatar,
  isValidXlsx,
  sanitizeFilename
};
