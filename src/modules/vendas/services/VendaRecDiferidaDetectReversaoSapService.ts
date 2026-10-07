import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { publishReverterDiferida } from "@/queue/producers/vendaRecDiferidaProducer";
import { parseFiscalYear } from "@/util/parseFiscalYear";

export interface DetectReversaoSapResult {
    totalReversoesSap: number;
    totalParcelasEnfileiradas: number;
    totalHeadersCancelados: number;
}

/**
 * Varre registros_contabeis em busca de JournalEntries de reversão (IsReversal = "X")
 * e, para cada uma, verifica se o documento revertido corresponde a uma VendaRecDiferida
 * com status INTEGRADO. Se sim, transiciona para REVERSAO_PENDENTE e enfileira o processamento.
 *
 * (DTZ-278) Ao reconhecer a reversão de uma parcela, o cabeçalho da venda é marcado
 * CANCELADO. Isso reverte os lançamentos já integrados (fluxo de reversão existente) e,
 * combinado com o guard do job de pendentes (que ignora parcelas de headers CANCELADO),
 * impede o lançamento de novas parcelas de diferimento daquela venda.
 */
export class VendaRecDiferidaDetectReversaoSapService {
    async execute(): Promise<DetectReversaoSapResult> {
        const result: DetectReversaoSapResult = {
            totalReversoesSap: 0,
            totalParcelasEnfileiradas: 0,
            totalHeadersCancelados: 0,
        };

        const reversalItems = await s4DotzClient.accountingDocumentItem.findMany({
            where: {
                IsReversal: "X",
                ReverseDocument: { not: null },
            },
            select: {
                CompanyCode: true,
                ReverseDocument: true,
                ReverseDocumentFiscalYear: true,
            },
        });

        if (!reversalItems.length) {
            log.info("[VendaRecDiferidaDetectReversaoSapService] Nenhum JE de reversão encontrado em registros_contabeis");
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
            `[VendaRecDiferidaDetectReversaoSapService] ${uniqueReversals.length} JEs de reversão únicos encontrados`,
        );

        for (const doc of uniqueReversals) {
            if (!doc.ReverseDocument) continue;

            try {
                await this.processarReversao(doc.ReverseDocument, doc.ReverseDocumentFiscalYear, result);
            } catch (error) {
                log.error(
                    `[VendaRecDiferidaDetectReversaoSapService] Erro ao processar reversão do documento ${doc.ReverseDocument}: %o`,
                    error,
                );
            }
        }

        return result;
    }

    private async processarReversao(
        reverseDocument: string,
        reverseDocumentFiscalYear: string | null,
        result: DetectReversaoSapResult,
    ): Promise<void> {
        // O código do documento SAP só é único DENTRO do ano fiscal (o SAP reinicia a sequência a
        // cada ano). Casar só pelo código faria uma reversão de 2026 corresponder a uma parcela de
        // 2025 com o mesmo número. O ano fica em `venda_rec_diferida.ano`.
        const ano = parseFiscalYear(reverseDocumentFiscalYear);
        if (ano === null) {
            log.warn(
                `[VendaRecDiferidaDetectReversaoSapService] Reversão do documento ${reverseDocument} sem ano fiscal; ` +
                `casando só por código (não é possível desambiguar por ano).`,
            );
        }

        // Verifica se existe parcela diferida com esse código de documento SAP (no mesmo ano)
        // e que ainda está no status INTEGRADO (idempotência: já REVERSAO_PENDENTE é ignorado)
        const parcela = await s4DotzClient.vendaRecDiferida.findFirst({
            where: {
                codigoDocumentoErp: reverseDocument,
                ...(ano !== null ? { ano } : {}),
                status: StatusVendaRecDiferida.INTEGRADO,
            },
            select: { id: true, vendasHeaderId: true },
        });

        if (!parcela) return;

        await s4DotzClient.vendaRecDiferida.update({
            where: { id: parcela.id },
            data: { status: StatusVendaRecDiferida.REVERSAO_PENDENTE },
        });

        await publishReverterDiferida({ vendaRecDiferidaId: parcela.id });

        log.info(
            `[VendaRecDiferidaDetectReversaoSapService] Parcela ${parcela.id} marcada REVERSAO_PENDENTE ` +
            `— documento SAP revertido: ${reverseDocument}`,
        );

        result.totalParcelasEnfileiradas += 1;

        await this.cancelarHeader(parcela.vendasHeaderId, reverseDocument, result);
    }

    /**
     * (DTZ-278) Marca o cabeçalho da venda como CANCELADO. Só transiciona quando o header
     * ainda não está CANCELADO (idempotência: várias parcelas da mesma venda podem ter
     * reversões detectadas no mesmo run). O CANCELADO é o que o job de pendentes usa para
     * barrar o lançamento de novas parcelas de diferimento (ver processVendaRecDiferidaPendentesJob).
     */
    private async cancelarHeader(
        vendasHeaderId: number,
        reverseDocument: string,
        result: DetectReversaoSapResult,
    ): Promise<void> {
        const atualizados = await s4DotzClient.vendasHeader.updateMany({
            where: { id: vendasHeaderId, status: { not: StatusVendas.CANCELADO } },
            data: { status: StatusVendas.CANCELADO },
        });

        if (atualizados.count > 0) {
            result.totalHeadersCancelados += atualizados.count;
            log.info(
                `[VendaRecDiferidaDetectReversaoSapService] Venda ${vendasHeaderId} marcada CANCELADO ` +
                `— documento SAP revertido: ${reverseDocument}`,
            );
        }
    }
}
