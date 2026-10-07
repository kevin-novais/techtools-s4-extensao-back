import path from "node:path";
import { GCSStorage } from "@/providers/gcs-storage";
import { Config } from "@/config/config";
import AppError from "@/util/AppError";

const MIME_TYPES: Record<string, string> = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf": "application/pdf",
};

// "planilhas" é mantida por compatibilidade: romaneios enviados antes da introdução
// de GCS_ROMANEIO_SUBFOLDER foram salvos nessa subpasta e continuam lá no GCS.
const SUBFOLDERS = [Config.GCS_ROMANEIO_SUBFOLDER, Config.GCS_POS_SUBFOLDER, "planilhas"];

export class PublicFileDownloadService {
    private readonly gcsStorage = new GCSStorage();

    async execute(filename: string): Promise<{ stream: NodeJS.ReadableStream; filename: string; mimeType: string }> {
        let blobName: string | null = null;

        for (const subfolder of SUBFOLDERS) {
            const candidate = `${subfolder}/${filename}`;
            if (await this.gcsStorage.exists(candidate)) {
                blobName = candidate;
                break;
            }
        }

        if (!blobName) throw new AppError("Arquivo não encontrado", 404);

        const ext = path.extname(filename).toLowerCase();
        const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

        return {
            stream: this.gcsStorage.createReadStream(blobName),
            filename,
            mimeType,
        };
    }
}
