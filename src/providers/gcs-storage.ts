import { Storage } from "@google-cloud/storage";
import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import apm from "@/apm";
import { Config } from "@/config/config";
import uploadConfig from "@/config/upload";
import AppError from "@/util/AppError";
import log from "@/util/logger";

export class GCSStorage {
    private readonly storage: Storage;
    private readonly bucket: string;

    constructor() {
        const isEmulator = Boolean(Config.GCS_EMULATOR_HOST);

        this.storage = new Storage({
            projectId: Config.GCS_PROJECT_ID || undefined,
            ...(isEmulator && { apiEndpoint: `http://${Config.GCS_EMULATOR_HOST}` }),
        });
        this.bucket = Config.GCS_BUCKET_NAME;
    }

    private get bucketName(): string {
        if (!this.bucket) {
            throw new AppError("A configuração GCS_BUCKET_NAME é obrigatória.", 500);
        }
        return this.bucket;
    }

    getPublicUrl(blobName: string): string {
        if (Config.GCS_EMULATOR_HOST) {
            return `http://${Config.GCS_EMULATOR_HOST}/${this.bucketName}/${blobName}`;
        }
        return `https://storage.googleapis.com/${this.bucketName}/${blobName}`;
    }

    private getBlobName(file: string, subfolder = "uploads"): string {
        return `${subfolder}/${file}`;
    }

    async saveFile(
        file: string,
        subfolder?: string,
        destinationFilename?: string,
    ): Promise<string> {
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);

        try {
            await fs.promises.access(tmpPath);
        } catch (error) {
            log.error("Erro ao acessar arquivo temporário: %o", error);
            throw new AppError("Erro ao acessar arquivo temporário", 500);
        }

        const blobName = this.getBlobName(destinationFilename ?? file, subfolder);

        try {
            await this.storage.bucket(this.bucketName).upload(tmpPath, {
                destination: blobName,
            });
        } catch (error: any) {
            apm.captureError(error);
            log.error("Erro ao fazer upload para GCS", {
                message: error?.message,
                code: error?.code,
                status: error?.status,
                errors: error?.errors,
            });
            throw new AppError(`Erro ao fazer upload para o storage: ${error?.message ?? "erro desconhecido"}`, 500);
        } finally {
            await fs.promises.unlink(tmpPath).catch(() => {});
        }

        return blobName;
    }

    async saveBytes(
        bytes: Buffer,
        subfolder?: string,
        fileName?: string,
    ): Promise<string> {

        const blobName = `${subfolder}/${fileName}`;

        try {
            await this.storage.bucket(this.bucketName).file(blobName).save(bytes);
        } catch (error: any) {
            apm.captureError(error);
            log.error("Erro ao fazer upload para GCS", {
                message: error?.message,
                code: error?.code,
                status: error?.status,
                errors: error?.errors,
            });
            throw new AppError(`Erro ao fazer upload para o storage: ${error?.message ?? "erro desconhecido"}`, 500);
        } 

        return blobName;
    }

    async deleteFile(file: string, subfolder?: string): Promise<void> {
        const blobName = this.getBlobName(file, subfolder);

        try {
            await this.storage.bucket(this.bucketName).file(blobName).delete();
        } catch (error: any) {
            if (error.code === 404) return;
            apm.captureError(error);
            log.error("Erro ao deletar arquivo do GCS", {
                message: error?.message,
                code: error?.code,
                status: error?.status,
            });
            throw error;
        }
    }

    extractBlobNameFromUrl(url: string): string {
        const parsed = new URL(url);
        const parts = parsed.pathname.slice(1).split("/");
        return parts.slice(1).join("/");
    }

    async downloadToTmp(blobName: string): Promise<string> {
        const filename = path.basename(blobName);
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, filename);

        await fs.promises.mkdir(uploadConfig.TMP_FOLDER, { recursive: true });

        try {
            await this.storage.bucket(this.bucketName).file(blobName).download({ destination: tmpPath });
        } catch (error: any) {
            apm.captureError(error);
            log.error("Erro ao baixar arquivo do GCS", {
                message: error?.message,
                code: error?.code,
                status: error?.status,
            });
            throw new AppError(`Erro ao baixar arquivo do storage: ${error?.message ?? "erro desconhecido"}`, 500);
        }

        return tmpPath;
    }

    async downloadByRelativePath(relativePath: string): Promise<Buffer> {
        try {
            const [bytes] = await this.storage
                .bucket(this.bucketName)
                .file(relativePath)
                .download();

            return bytes;
        } catch (error: any) {
            apm.captureError(error);
            log.error("Erro ao baixar arquivo do GCS", {
                relativePath,
                message: error?.message,
                code: error?.code,
                status: error?.status,
            });
            throw new AppError(
                `Erro ao baixar arquivo do storage: ${error?.message ?? "erro desconhecido"}`,
                500,
            );
        }
    }

    async exists(blobName: string): Promise<boolean> {
        const [exists] = await this.storage.bucket(this.bucketName).file(blobName).exists();
        return exists;
    }

    createReadStream(blobName: string): Readable {
        return this.storage.bucket(this.bucketName).file(blobName).createReadStream();
    }

    async findByHashPrefix(subfolder: string, hash: string): Promise<string | null> {
        const [files] = await this.storage
            .bucket(this.bucketName)
            .getFiles({ prefix: `${subfolder}/${hash}`, maxResults: 1 });
        return files[0]?.name ?? null;
    }

    async deleteTmpFile(file: string): Promise<void> {
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);

        try {
            await fs.promises.stat(tmpPath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
            throw error;
        }

        await fs.promises.unlink(tmpPath);
    }
}
