import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { GerarRelatorioDocumentoService } from "@/modules/documento-fiscal/utils/relatorio/GerarRelatorioDocumentoService";

interface DocumentoRelatorioParams {
    documentoFiscalHeaderId: number;
    ciaIds: number[];
}

interface DocumentoRelatorioResponse {
    pdfPath: string;
    pdfFilename: string;
    xlsxPath: string;
    xlsxFilename: string;
}

/**
 * Service para geração de relatório de documento fiscal via API.
 * Responsável por validar permissões do usuário antes de delegar para o service reutilizável.
 */
export class DocumentoRelatorioService {
    async execute(params: DocumentoRelatorioParams): Promise<DocumentoRelatorioResponse> {
        const { documentoFiscalHeaderId, ciaIds } = params;

        if (ciaIds.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        // Busca leve apenas para validar permissões
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoFiscalHeaderId },
            select: { ciaId: true },
        });

        if (!documento) {
            throw new AppError("Documento fiscal não encontrado", 404);
        }

        if (!ciaIds.includes(documento.ciaId)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        // Delega para o service reutilizável
        const gerarRelatorioService = new GerarRelatorioDocumentoService();
        return gerarRelatorioService.execute({ documentoFiscalHeaderId });
    }
}
