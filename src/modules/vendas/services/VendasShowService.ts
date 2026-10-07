import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import AppError from "@/util/AppError";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import { buildPublicFileUrl } from "@/util/file-url";
import { VENDAS_SHOW_SELECT } from "@/modules/vendas/utils/vendasHeaderSelect";

export class VendasShowService {
    async execute(id: number, ciaIds: number[]) {
        if (ciaIds.length === 0) {
            throw new AppError("Você não tem acesso a nenhuma CIA", 403);
        }

        const venda = await s4DotzClient.vendasHeader.findUnique({
            where: { id },
            select: {
                ...VENDAS_SHOW_SELECT,
                vendasDetalhe: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!venda) {
            throw new AppError("Venda não encontrada", 404);
        }

        // Validar acesso à CIA — VendasHeader.ciaIdSAP armazena o código SAP da CIA
        const cia = await s4DotzClient.cia.findFirst({
            where: {
                ciaIdSAP: venda.ciaIdSAP,
                deletadoEm: null,
            },
            select: {
                id: true,
                nome: true,
            },
        });

        if (!cia || !ciaIds.includes(cia.id)) {
            throw new AppError("Você não tem acesso a esta CIA", 403);
        }

        // Buscar nome do cliente SAP
        let cardName: string | null = null;

        if (venda.codigoClienteSAP) {
            const cliente = await dotzStageClient().oCRD.findUnique({
                where: { CardCode: venda.codigoClienteSAP },
                select: { CardName: true },
            });

            cardName = cliente?.CardName ?? null;
        }

        return {
            id: venda.id,
            ciaIdSAP: venda.ciaIdSAP,
            cia: {
                id: cia.id,
                nome: cia.nome,
            },
            status: venda.status,
            tipoCadastro: venda.tipoCadastro,
            codigoClienteAnalyzer: venda.codigoClienteAnalyzer,
            codigoClienteSAP: venda.codigoClienteSAP,
            codigoDocumentoERP: venda.codigoDocumentoERP,
            cardName,
            numeroDocumentoAnalyzer: venda.numeroDocumentoAnalyzer,
            infoReferenciaAnalyzer: venda.infoReferenciaAnalyzer,
            valorTotalVendas: venda.valorTotalVendas ? venda.valorTotalVendas.toString() : null,
            pathArquivoFaturaDetalhadaAnalyzer: buildPublicFileUrl(venda.pathArquivoFaturaDetalhadaAnalyzer),
            pathArquivoRelatorioAnalitico: buildPublicFileUrl(venda.pathArquivoRelatorioAnalitico),
            dataEmissao: formatDateOnly(venda.dataEmissao),
            dataFechamentoDe: formatDateOnly(venda.dataFechamentoDe),
            dataFechamentoAte: formatDateOnly(venda.dataFechamentoAte),
            dataLancamentoContabil: formatDateOnly(venda.dataLancamentoContabil),
            dataVencimento: formatDateOnly(venda.dataVencimento),
            dataIntegracao: formatDateOnly(venda.dataIntegracao),
            documentoJson: venda.documentoJson,
            retornoIntegracaoSap: venda.retornoIntegracaoSap,
            relatorioPdf: buildPublicFileUrl(venda.relatorioPdf),
            relatorioXlsx: buildPublicFileUrl(venda.relatorioXlsx),
            pathBoleto: buildPublicFileUrl(venda.pathBoleto),
            retornoConsultaBoletoInvent: venda.retornoConsultaBoletoInvent,
            dataUltimaConsultaBoleto: formatDateToBrazilianTimezone(venda.dataUltimaConsultaBoleto),
            dataEnvioEmail: formatDateToBrazilianTimezone(venda.dataEnvioEmail),
            destinatarioEmail: venda.destinatarioEmail,
            retornoEnvioEmail: venda.retornoEnvioEmail,
            quantidadeDetalhes: venda.vendasDetalhe.length,
            criadoEm: formatDateToBrazilianTimezone(venda.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(venda.atualizadoEm),
        };
    }
}
