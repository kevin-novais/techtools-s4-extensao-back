import { BuildSapIntegrationVendas, VendasBuildIntegrationJsonParams, IntegracaoSAPJson } from "@/modules/vendas/utils/BuildSapIntegrationVendas";
import { GerarRelatorioVendasService } from "@/modules/vendas/utils/relatorio/GerarRelatorioVendasService";

interface VendasBuildIntegrationJsonResponse {
    integracoesJson: IntegracaoSAPJson[];
    relatorios: {
        pdfUrl: string;
        xlsxUrl: string;
    };
}

export class VendasBuildIntegrationJsonService {
    async execute(params: VendasBuildIntegrationJsonParams): Promise<VendasBuildIntegrationJsonResponse> {

        // Montar JSON de integração (sem anexos de relatório)
        const integracoesJson = await new BuildSapIntegrationVendas().execute(params);

        // Gerar relatórios para teste/visualização (no fluxo real, relatórios são gerados pós-SAP)
        const relatorioService = new GerarRelatorioVendasService();
        const relatorio = await relatorioService.execute({ vendasHeaderId: params.vendasHeaderId });

        return {
            integracoesJson,
            relatorios: {
                pdfUrl: relatorio.pdfUrl,
                xlsxUrl: relatorio.xlsxUrl,
            },
        };
    }
}
