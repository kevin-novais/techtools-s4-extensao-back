import type { DetalheParaInserir, PosLinhaData } from "@/modules/documento-fiscal/documento-details/pos/services/processamento/types/ProcessamentoPosTypes";
import type { ConfiguracaoContabilData } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/types/ProcessamentoTypes";
import { ConfiguracaoContabilApplicatorService } from "@/modules/documento-fiscal/documento-details/romaneio/services/processamento/applicators/ConfiguracaoContabilApplicatorService";
import log from "@/util/logger";

interface DocumentoInfo {
    id: number;
    codigoDocumento: string;
}

export class PosToDetalheMapperService {
    private readonly configApplicator: ConfiguracaoContabilApplicatorService;

    constructor() {
        this.configApplicator = new ConfiguracaoContabilApplicatorService();
    }

    /**
     * Mapeia array de linhas POR1 para DetalheParaInserir
     * Aplica configuração contábil quando disponível
     * Verifica duplicação cross-documento
     */
    mapLinhas(
        linhas: PosLinhaData[],
        documento: DocumentoInfo,
        itemSequenceStart: number,
        configContabil: ConfiguracaoContabilData,
        // pedidosDuplicados: Set<string>
    ): DetalheParaInserir[] {
        log.info(`[PosToDetalheMapperService] Mapeando ${linhas.length} linhas para detalhes`);

        return linhas.map((linha, index) => {
            return this.mapLinha(
                linha,
                documento,
                itemSequenceStart + index,
                configContabil,
                // pedidosDuplicados
            );
        });
    }

    private mapLinha(
        linha: PosLinhaData,
        documento: DocumentoInfo,
        itemSequence: number,
        configContabil: ConfiguracaoContabilData,
        // pedidosDuplicados: Set<string>
    ): DetalheParaInserir {
        // Determinar grupo PIS/COFINS
        const grupoPisCofins = linha.OITM?.U_Seidor_PC_Calcula === 1 ? 'S' : 'N';

        // Converter valores
        const valorPedido = linha.LineTotal ? Number(linha.LineTotal) : 0;

        const detalhe: DetalheParaInserir = {
            documentoFiscalHeaderId: documento.id,
            codigoDocumento: documento.codigoDocumento,
            itemDocumento: itemSequence,
            codigoFornecedorSAP: linha.OPOR.CardCode,
            codigoProdutoDotz: linha.ItemCode,
            codigoProdutoFornecedor: linha.OITM?.SuppCatNum || null,
            codigoProdutoRomaneio: null,
            quantidadeProduto: linha.Quantity ? Number(linha.Quantity) : null,
            descricaoProduto: linha.Dscription,
            valorProduto: linha.LineTotal ? Number(linha.LineTotal) : null,
            valorPedido,
            valorFrete: null, // POS não tem frete separado
            valorCombo: null, // POS não tem combo separado
            codigoPedidoParceiro: linha.OPOR.U_DOTZNRPED ? String(linha.OPOR.U_DOTZNRPED) : null,
            codigoPedidoAnalyzer: String(linha.OPOR.DocEntry),
            codigoDocumentoERP: linha.U_DocEntryNF ? String(linha.U_DocEntryNF) : null,
            grupoPisCofins,
            divergencias: false, // POS não tem validações de divergência
            erros: [], // Inicializa array vazio para possíveis erros de config
        };

        // Validação: Verificar se linha está cancelada/fechada
        if (linha.LineStatus === 'C') {
            detalhe.erros.push({
                code: "22",
                message: `Linha do pedido está cancelada (LineStatus = 'C')`,
            });
            detalhe.divergencias = true;
        }

        // Validação: Verificar se pedido está cancelado/fechado
        if (linha.OPOR?.DocStatus === 'C') {
            detalhe.erros.push({
                code: "23",
                message: `Pedido está cancelado ou fechado (DocStatus = 'C')`,
            });
            detalhe.divergencias = true;
        }

        // Aplicar configuração contábil (contas e PIS/COFINS)
        // Comportamento leniente: se não encontrar config, apenas loga e continua
        const resultado = this.configApplicator.execute(detalhe, configContabil);

        // Salva o ID da configuração aplicada (se houver)
        detalhe.configuracaoContabilDetalheId = resultado.configuracaoContabilDetalheId;

        // Se houver divergências de config, adiciona aos erros e loga
        if (resultado.divergencias.length > 0) {
            detalhe.erros.push(...resultado.divergencias);
            detalhe.divergencias = true;
            log.warn(
                `[PosToDetalheMapperService] Linha ${itemSequence} (POS_ID: ${linha.U_POS_ID}): Config contábil não aplicada - ${resultado.divergencias.map(d => d.message).join('; ')}`
            );
        }

        return detalhe;
    }
}

