import { DocumentoFiscalHeader, Usuario, Cia } from "@prisma/client-s4-dotz";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";
import {
    extractLegadoMensagemSap,
    parseRetornoIntegracaoSap,
} from "@/modules/documento-fiscal/utils/integracao/retornoIntegracaoSapJson";
import {
    parsePayloadEnvioSap,
} from "@/modules/documento-fiscal/utils/documentoJsonEnvioSap";

type UsuarioResumo = Pick<Usuario, "id" | "nome" | "email">;
type CiaResumo = Pick<Cia, "id" | "nome">;
type DetalheResumo = { divergencias: boolean | null };

type DocumentoFiscalHeaderWithRelations = DocumentoFiscalHeader & {
    cia?: CiaResumo | null;
    criadoPorUsuario?: UsuarioResumo | null;
    atualizadoPorUsuario?: UsuarioResumo | null;
    documentoFiscalDetalhes?: DetalheResumo[];
};

const formatUsuario = (usuario?: UsuarioResumo | null) =>
    usuario
        ? {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
        }
        : null;

const formatCia = (cia?: CiaResumo | null) =>
    cia
        ? {
            id: cia.id,
            nome: cia.nome,
        }
        : null;

const STATUS_LABELS: Record<string, string> = {
    [StatusDocumento.AGUARDANDO]: "Aguardando",
    [StatusDocumento.PROCESSANDO]: "Processando",
    [StatusDocumento.ERRO_PROCESSAMENTO]: "Erro no Processamento",
    [StatusDocumento.DIVERGENCIA]: "Divergência",
    [StatusDocumento.APROVADO]: "Aprovado",
    [StatusDocumento.REPROVADO]: "Reprovado",
    [StatusDocumento.INTEGRADO]: "Integrado",
    [StatusDocumento.ERRO_INTEG]: "Erro na Integração",
    [StatusDocumento.RETORNO_INTEG]: "Retorno da Integração",
    [StatusDocumento.ERRO_RETORNO_INTEG]: "Erro no Retorno da Integração",
    [StatusDocumento.ENVIAR_EMAIL]: "Enviando E-mail",
    [StatusDocumento.ERRO_ENVIAR_EMAIL]: "Erro ao Enviar E-mail",
    [StatusDocumento.PROCESSADO]: "Processado",
};

const formatDecimal = (value: any) => (value ? value.toString() : null);

const formatDateOptional = (date: Date | null | undefined) =>
    date ? formatDateOnly(date) : null;

const formatTimestampOptional = (timestamp: Date | null | undefined) =>
    timestamp ? formatDateToBrazilianTimezone(timestamp) : null;

const calcularDivergencias = (
    count: number | undefined,
    detalhes?: DetalheResumo[]
) => {
    if (count !== undefined) return count;
    if (!detalhes) return null;
    return detalhes.filter(detalhe => detalhe.divergencias === true).length;
};

export const formatDocumentoFiscalHeader = (
    record: DocumentoFiscalHeaderWithRelations,
    cardName: string | null = null,
    quantidadeTotalDivergenciasCount?: number
) => {
    const quantidadeTotalDivergencias = calcularDivergencias(
        quantidadeTotalDivergenciasCount,
        record.documentoFiscalDetalhes
    );

    return {
        id: record.id,
        ciaId: record.ciaId,
        cia: formatCia(record.cia),
        codigoFornecedorSAP: record.codigoFornecedorSAP,
        cardName,
        codigoFornecedorAnalyzer: record.codigoFornecedorAnalyzer,
        codigoDocumento: record.codigoDocumento,
        tipoDocumentoERP: record.tipoDocumentoERP,
        tipoContabilERP: record.tipoContabilERP ?? null,
        status: record.status,
        statusLabel: STATUS_LABELS[record.status] ?? record.status,
        romaneioUrl: record.romaneioUrl ?? null,
        romaneioFileName: record.romaneioFileName ?? null,
        posRelatorioPdfUrl: record.posRelatorioPdfUrl ?? null,
        posRelatorioPdfFileName: record.posRelatorioPdfFileName ?? null,
        posRelatorioXlsxUrl: record.posRelatorioXlsxUrl ?? null,
        posRelatorioXlsxFileName: record.posRelatorioXlsxFileName ?? null,
        observacoesRomaneio: record.observacoesRomaneio,
        dataEmissao: formatDateOnly(record.dataEmissao),
        dataLancamentoContabil: formatDateOnly(record.dataLancamentoContabil),
        dataVencimento: formatDateOnly(record.dataVencimento),
        dataProcessamentoInicio: formatTimestampOptional(record.dataProcessamentoInicio),
        dataProcessamentoFim: formatTimestampOptional(record.dataProcessamentoFim),
        dataIntegracao: formatDateOptional(record.dataIntegracao),
        quantidadeTotalPedidos: record.quantidadeTotalPedidos,
        quantidadeTotalDivergencias,
        retornoIntegracaoSap: parseRetornoIntegracaoSap(record.retornoIntegracaoSap),
        erroIntegracaoSap: extractLegadoMensagemSap(record.retornoIntegracaoSap),
        /** Payload(s) enviado(s) ao SAP (`createJournalEntry`) — envelope único; legado: array na raiz é normalizado */
        payloadEnvioSap: parsePayloadEnvioSap(record.documentoJson, record.id),
        valorTotalProdutos: formatDecimal(record.valorTotalProdutos),
        valorTotalPedido: formatDecimal(record.valorTotalPedido),
        valorTotalFrete: formatDecimal(record.valorTotalFrete),
        valorTotalCombo: formatDecimal(record.valorTotalCombo),
        valorTotalProdutosAnalyzer: formatDecimal(record.valorTotalProdutosAnalyzer),
        valorTotalPedidoAnalyzer: formatDecimal(record.valorTotalPedidoAnalyzer),
        valorTotalFreteAnalyzer: formatDecimal(record.valorTotalFreteAnalyzer),
        valorTotalComboAnalyzer: formatDecimal(record.valorTotalComboAnalyzer),
        valorTotalIs: formatDecimal(record.valorTotalIs),
        valorTotalCbs: formatDecimal(record.valorTotalCbs),
        valorTotalIbsUf: formatDecimal(record.valorTotalIbsUf),
        valorTotalIbsMunicipal: formatDecimal(record.valorTotalIbsMunicipal),
        criadoPor: record.criadoPor,
        criadoPorUsuario: formatUsuario(record.criadoPorUsuario),
        criadoEm: formatDateToBrazilianTimezone(record.criadoEm),
        atualizadoPor: record.atualizadoPor,
        atualizadoPorUsuario: formatUsuario(record.atualizadoPorUsuario),
        atualizadoEm: formatDateToBrazilianTimezone(record.atualizadoEm),
    };
};

export const getDocumentoUrl = (fileUrl: string) => {
    return fileUrl;
}