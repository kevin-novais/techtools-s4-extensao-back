import { BuildSapIntegration, DocumentoFiscalBuildIntegrationJsonParams, IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";
import { EnviarRelatorioFornecedorEmailService } from "@/modules/documento-fiscal/utils/integracao/EnviarRelatorioFornecedorEmailService";
import log from "@/util/logger";

export class DocumentoFiscalBuildIntegrationJsonService {
    private readonly relatorioEmailService: EnviarRelatorioFornecedorEmailService;

    constructor() {
        this.relatorioEmailService = new EnviarRelatorioFornecedorEmailService();
    }

    async execute(params: DocumentoFiscalBuildIntegrationJsonParams): Promise<IntegracaoSAPJson[]> {
        const { documentoFiscalHeaderId, usuarioId } = params;

        const integracoesJson = await new BuildSapIntegration().execute({
            documentoFiscalHeaderId,
            usuarioId,
        });

        await this.enviarRelatoriosParaFila(documentoFiscalHeaderId, integracoesJson);

        return integracoesJson;
    }

    private async enviarRelatoriosParaFila(
        documentoFiscalHeaderId: number,
        integracoesJson: IntegracaoSAPJson[]
    ): Promise<void> {
        for (const integracaoJson of integracoesJson) {
            const relatorioAnexos = this.obterRelatorioAnexos(integracaoJson);
            if (!relatorioAnexos) {
                log.error(
                    `[DocumentoBuildIntegrationJsonService] Relatorio nao encontrado nos anexos para fornecedor ${integracaoJson.codigoParceiro}`
                );
                continue;
            }

            await this.relatorioEmailService.execute({
                documentoFiscalHeaderId,
                codigoFornecedorSAP: integracaoJson.codigoParceiro ?? "",
            });
        }
    }

    private obterRelatorioAnexos(
        integracaoJson: IntegracaoSAPJson
    ): { pdfUrl: string; xlsxUrl: string } | null {
        const relatorioPdf = integracaoJson.anexos?.find((anexo) => anexo.nomeAnexo === "RELATORIO");
        const relatorioXlsx = integracaoJson.anexos?.find((anexo) => anexo.nomeAnexo === "RELATORIO_XLSX");

        if (!relatorioPdf?.localAnexo || !relatorioXlsx?.localAnexo) {
            return null;
        }

        return {
            pdfUrl: relatorioPdf.localAnexo,
            xlsxUrl: relatorioXlsx.localAnexo,
        };
    }
}