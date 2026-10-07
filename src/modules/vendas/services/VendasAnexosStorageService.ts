import AppError from "@/util/AppError";
import { sanitizeFilename } from "@/config/upload";
import { GCSStorage } from "@/providers/gcs-storage";

const ANEXOS_VENDA_FOLDER = "ANEXOS_VENDA";

export interface VendasAnexos {
    arquivoFaturaDetalhada?: Express.Multer.File;
    arquivoRelatorioAnalitico?: Express.Multer.File;
}

export interface VendasAnexosUploadResult {
    paths: {
        pathArquivoFaturaDetalhadaAnalyzer?: string;
        pathArquivoRelatorioAnalitico?: string;
    };
    storedFilenames: string[];
}

export class VendasAnexosStorageService {
    constructor(private readonly gcsStorage: GCSStorage = new GCSStorage()) {}

    async upload(
        vendasHeaderId: number,
        anexos: VendasAnexos = {},
    ): Promise<VendasAnexosUploadResult> {
        const entries = [
            {
                file: anexos.arquivoFaturaDetalhada,
                pathField: "pathArquivoFaturaDetalhadaAnalyzer" as const,
            },
            {
                file: anexos.arquivoRelatorioAnalitico,
                pathField: "pathArquivoRelatorioAnalitico" as const,
            },
        ].filter(
            (entry): entry is typeof entry & { file: Express.Multer.File } =>
                entry.file !== undefined,
        );

        const filenames = entries.map(({ file }) =>
            sanitizeFilename(file.originalname.trim()),
        );

        if (filenames.some((filename) => filename.length === 0)) {
            throw new AppError("Nome de arquivo inválido", 400);
        }

        if (new Set(filenames).size !== filenames.length) {
            throw new AppError("Os anexos devem possuir nomes diferentes", 400);
        }

        const subfolder = `${ANEXOS_VENDA_FOLDER}/${vendasHeaderId}`;
        const paths: VendasAnexosUploadResult["paths"] = {};
        const storedFilenames: string[] = [];

        try {
            for (const [index, entry] of entries.entries()) {
                const destinationFilename = filenames[index];
                const blobName = await this.gcsStorage.saveFile(
                    entry.file.filename,
                    subfolder,
                    destinationFilename,
                );

                storedFilenames.push(destinationFilename);
                paths[entry.pathField] = this.gcsStorage.getPublicUrl(blobName);
            }
        } catch (error) {
            await this.cleanupStoredFiles(vendasHeaderId, storedFilenames);
            throw error;
        } finally {
            await this.cleanupTemporaryFiles(anexos);
        }

        return { paths, storedFilenames };
    }

    async cleanupStoredFiles(
        vendasHeaderId: number,
        filenames: string[],
    ): Promise<void> {
        const subfolder = `${ANEXOS_VENDA_FOLDER}/${vendasHeaderId}`;
        await Promise.allSettled(
            filenames.map((filename) =>
                this.gcsStorage.deleteFile(filename, subfolder),
            ),
        );
    }

    async cleanupTemporaryFiles(anexos: VendasAnexos = {}): Promise<void> {
        const files = [
            anexos.arquivoFaturaDetalhada,
            anexos.arquivoRelatorioAnalitico,
        ].filter((file): file is Express.Multer.File => file !== undefined);

        await Promise.allSettled(
            files.map((file) => this.gcsStorage.deleteTmpFile(file.filename)),
        );
    }
}
