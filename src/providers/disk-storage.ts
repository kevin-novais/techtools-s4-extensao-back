import fs from "node:fs";
import path from "node:path";
import uploadConfig from "@/config/upload";
import AppError from "@/util/AppError";
import log from "@/util/logger";

export class DiskStorage {
  async saveFile(file: string, subfolder?: string) {
    const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);
    
    // Define destination folder based on subfolder parameter
    let destinationFolder: string;
    if (subfolder === "avatars") {
      destinationFolder = uploadConfig.AVATARS_STORAGE_FOLDER;
    } else if (subfolder === "planilhas") {
      destinationFolder = uploadConfig.PLANILHAS_STORAGE_FOLDER;
    } else {
      destinationFolder = uploadConfig.UPLOADS_STORAGE_FOLDER;
    }
    
    const uploadPath = path.resolve(destinationFolder, file);

    try {
      await fs.promises.access(tmpPath);
    } catch (error) {
      log.error("Erro ao acessar arquivo temporário: %o", error);
      throw new AppError("Erro ao acessar arquivo temporário", 500);
    }

    // Create destination folder if it doesn't exist
    await fs.promises.mkdir(destinationFolder, { recursive: true });

    // Copy file to destination
    await fs.promises.copyFile(tmpPath, uploadPath);
    
    // Delete file from tmp folder after successful copy
    await fs.promises.unlink(tmpPath);

    return file;
  }

  async deleteFile(file: string, subfolder?: string) {
    // Define destination folder based on subfolder parameter
    let destinationFolder: string;
    if (subfolder === "avatars") {
      destinationFolder = uploadConfig.AVATARS_STORAGE_FOLDER;
    } else if (subfolder === "planilhas") {
      destinationFolder = uploadConfig.PLANILHAS_STORAGE_FOLDER;
    } else {
      destinationFolder = uploadConfig.UPLOADS_STORAGE_FOLDER;
    }
    
    const filePath = path.resolve(destinationFolder, file);
    
    try {
      await fs.promises.stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    await fs.promises.unlink(filePath);
  }

  async deleteTmpFile(file: string) {
    const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);
    
    try {
      await fs.promises.stat(tmpPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    await fs.promises.unlink(tmpPath);
  }
}
