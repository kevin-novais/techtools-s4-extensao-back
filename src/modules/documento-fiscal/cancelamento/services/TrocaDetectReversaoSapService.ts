import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { ReabrirPedidosTrocaService } from "@/modules/documento-fiscal/cancelamento/services/ReabrirPedidosTrocaService";
import { parseFiscalYear } from "@/util/parseFiscalYear";

export interface DetectTrocaReversaoSapResult {
    totalReversoesSap: number;
    totalHeadersCancelados: number;
}

/**
 * (DTZ-279) Varre registros_contabeis em busca de JournalEntries de reversão (IsReversal = "X",
 * accounting_document_item = 1) e, para cada uma, verifica se o documento revertido corresponde à
 * integração de um romaneio de troca. O código do documento SAP fica em
 * `documento_fiscal_detail.codigo_documento_erp` (o header não guarda esse código — validado na
 * HML). Casando por aí chega-se ao `documento_fiscal_header`; se ele ainda não está CANCELADO,
 * reabre os pedidos no OPOR/POR1 (para reintegrar com outro romaneio) e marca o header CANCELADO.
 *
 * Espelha o VendaRecDiferidaDetectReversaoSapService — ambos leem a mesma varredura de reversões de
 * registros_contabeis (o "lugar único" de identificação) e despacham para a regra do seu módulo.
 * A idempotência vem do guard `status <> CANCELADO` (uma vez cancelado, não é mais reprocessado).
 */
export class TrocaDetectReversaoSapService {
    constructor(private readonly reabrirPedidos: ReabrirPedidosTrocaService = new ReabrirPedidosTrocaService()) {}

    async execute(): Promise<DetectTrocaReversaoSapResult> {
        const result: DetectTrocaReversaoSapResult = {
            totalReversoesSap: 0,
            totalHeadersCancelados: 0,
        };

        const reversalItems = await s4DotzClient.accountingDocumentItem.findMany({
            where: {
                IsReversal: "X",
                ReverseDocument: { not: null },
                AccountingDocumentItem: { in: ["1", "001"] },
            },
            select: {
                CompanyCode: true,
                ReverseDocument: true,
                ReverseDocumentFiscalYear: true,
            },
        });

        if (!reversalItems.length) {
            log.info("[TrocaDetectReversaoSapService] Nenhum JE de reversão encontrado em registros_contabeis");
            return result;
        }

        // Dedupe por CompanyCode + ReverseDocument + ano fiscal: o SAP reinicia a sequência do
        // número do documento a cada ano, então o mesmo código em anos diferentes é outro documento.
        const seen = new Set<string>();
        const uniqueReversals = reversalItems.filter(
            (item: { CompanyCode: string; ReverseDocument: string | null; ReverseDocumentFiscalYear: string | null }) => {
                const key = `${item.CompanyCode}|${item.ReverseDocument}|${item.ReverseDocumentFiscalYear}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            },
        );

        result.totalReversoesSap = uniqueReversals.length;

        log.info(
            `[TrocaDetectReversaoSapService] ${uniqueReversals.length} JEs de reversão únicos encontrados`,
        );

        for (const doc of uniqueReversals) {
            if (!doc.ReverseDocument) continue;

            try {
                await this.processarReversao(doc.ReverseDocument, doc.ReverseDocumentFiscalYear, result);
            } catch (error) {
                log.error(
                    `[TrocaDetectReversaoSapService] Erro ao processar reversão do documento ${doc.ReverseDocument}: %o`,
                    error,
                );
            }
        }

        return result;
    }

    private async processarReversao(
        reverseDocument: string,
        reverseDocumentFiscalYear: string | null,
        result: DetectTrocaReversaoSapResult,
    ): Promise<void> {
        // O código do documento SAP só é único DENTRO do ano fiscal (o SAP reinicia a sequência a
        // cada ano). No lado troca o detalhe guarda só o código; o ano vem do header (`ano`). Sem
        // o filtro de ano, um código de 2026 poderia casar um romaneio de 2025 (documento errado).
        const ano = parseFiscalYear(reverseDocumentFiscalYear);
        if (ano === null) {
            log.warn(
                `[TrocaDetectReversaoSapService] Reversão do documento ${reverseDocument} sem ano fiscal; ` +
                `casando só por código (não é possível desambiguar por ano).`,
            );
        }

        // O código do documento SAP fica no detalhe; o filtro na relação garante a idempotência
        // (headers já CANCELADO não são reencontrados).
        const detalhe = await s4DotzClient.documentoFiscalDetalhe.findFirst({
            where: {
                codigoDocumentoERP: reverseDocument,
                documentoFiscalHeader: {
                    status: { not: StatusDocumento.CANCELADO },
                    ...(ano !== null ? { ano } : {}),
                },
            },
            select: { documentoFiscalHeaderId: true },
        });

        if (!detalhe) return;

        const headerId = detalhe.documentoFiscalHeaderId;

        // Reabre os pedidos primeiro; se o cancelamento do header falhar depois, o próximo run
        // reencontra o header (ainda não CANCELADO) e a reabertura é idempotente (DocStatus='O').
        await this.reabrirPedidos.execute(headerId);

        const atualizados = await s4DotzClient.documentoFiscalHeader.updateMany({
            where: { id: headerId, status: { not: StatusDocumento.CANCELADO } },
            data: { status: StatusDocumento.CANCELADO },
        });

        if (atualizados.count > 0) {
            result.totalHeadersCancelados += atualizados.count;
            log.info(
                `[TrocaDetectReversaoSapService] Romaneio ${headerId} marcado CANCELADO ` +
                `— documento SAP revertido: ${reverseDocument}`,
            );
        }
    }
}
