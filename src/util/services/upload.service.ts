import { GCSStorage } from "@/providers/gcs-storage";
import uploadConfig from "@/config/upload";
import AppError from "@/util/AppError";
import { Config } from "@/config/config";

export class UploadDiskStorageService {
    gcsStorage = new GCSStorage();

    async uploadAvatar(file: string) {
        if (!uploadConfig.isValidAvatar(file)) {
            throw new AppError("Tipo de arquivo inválido para avatar", 400);
        }
        const blobName = await this.gcsStorage.saveFile(file, "avatars");
        return this.gcsStorage.getPublicUrl(blobName);
    }

    async uploadRomaneio(file: string) {
        if (!uploadConfig.isValidXlsx(file)) {
            throw new AppError("Tipo de arquivo inválido para planilha. Apenas arquivos .xlsx são aceitos", 400);
        }
        return this.gcsStorage.saveFile(file, Config.GCS_ROMANEIO_SUBFOLDER);
    }

    async uploadReportPos(bytes: Buffer, fileName:string) {
        const blobName = await this.gcsStorage.saveBytes(bytes, Config.GCS_POS_SUBFOLDER, fileName);
        return blobName;
    }

    async cleanupFile(filename: string, subfolder?: string) {
        await this.gcsStorage.deleteFile(filename, subfolder);
    }

    async cleanupTmpFile(filename: string) {
        await this.gcsStorage.deleteTmpFile(filename);
    }

    extractFilenameFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');
            return parts[parts.length - 1];
        } catch {
            const parts = url.split('/');
            return parts[parts.length - 1];
        }
    }
}
