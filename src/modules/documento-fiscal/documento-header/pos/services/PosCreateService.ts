import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { PosHeaderRow, PosRawQueryRepository } from "@/modules/documento-fiscal/documento-details/pos/services/PosRawQueryRepository";
import { publishProcessarDetalhesPOS } from "@/queue/producers/documentoFiscalProducer";
import AppError from "@/util/AppError";
import {
    formatDateOnly,
    normalizeDateToMidnightUTC,
} from "@/util/date";
import log from "@/util/logger";

interface PosCreateParams {
    ciaId: number;
    dataEmissao: Date;
    dataLancamentoContabil: Date;
    dataVencimento: Date;
    filtros: {
        dataEmissaoDe?: string;
        dataEmissaoAte?: string;
        dataVencimentoDe?: string;
        dataVencimentoAte?: string;
        segmento?: string;
    };
    usuarioId: number;
}

interface UsuarioGrupoUsuarioRecord {
    grupoUsuario: {
        dataInicio: Date;
        dataFim: Date;
    };
}

export class PosCreateService {
    private readonly rawQueryRepository: PosRawQueryRepository;

    constructor() {
        this.rawQueryRepository = new PosRawQueryRepository();
    }

    async execute(params: PosCreateParams) {
        const { ciaId, dataEmissao, dataLancamentoContabil, dataVencimento, filtros, usuarioId } = params;

        log.info(`[PosCreateService] Iniciando criação de documento POS para CIA ${ciaId}`);

        // Validações.
        const cia = await this.validateCia(ciaId);
        await this.validateUsuarioGrupos(usuarioId, ciaId, cia.nome, dataLancamentoContabil);
        this.validateDatas(dataEmissao, dataLancamentoContabil, dataVencimento);
        this.validateFiltros(filtros);

        const parceiros = await this.fetchMatrizFilias(filtros);

        if (parceiros.length === 0) {
            throw new AppError("Nenhum pedido encontrado com os filtros aplicados", 404);
        }

        // Buscar configuração contábil
        const tipoContabilERP = await this.fetchConfiguracaoContabil(ciaId);

        const documentosCriados = [];

        for (const parceiro of parceiros) {
            const codigoDocumento = await this.generateCodigoDocumento();

            const filtrosComSegmento = { ...filtros, segmento: parceiro.codigoParceiroSap };

            const documento = await this.createDocumento({
                ciaId,
                codigoDocumento,
                codigoFornecedorSAP: parceiro.codigoParceiroSap!,
                codigoFornecedorAnalyzer: String(parceiro.codigoParceiroAnalyzer),
                dataEmissao,
                dataLancamentoContabil,
                dataVencimento,
                romaneioUrl: null, // POS não tem arquivo de origem
                usuarioId,
                tipoContabilERP,
                filtrosPosJson: JSON.stringify(filtrosComSegmento),
            });

            await publishProcessarDetalhesPOS({
                documentoFiscalHeaderId: documento.id,
                filtros: filtrosComSegmento,
            });

            log.debug(`[PosCreateService] Documento ${codigoDocumento} criado para matriz|filial ${parceiro.codigoPai} | ${parceiro.codigoParceiroSap}`);

            documentosCriados.push({
                id: documento.id,
                codigoDocumento: documento.codigoDocumento,
                parceiro: parceiro,
                totalPedidos: parceiro.totalPedidos,
                status: documento.status,
            });
        }

        return {
            message: `Documentos fiscais POS criados. Processamento iniciado.`,
            documentos: documentosCriados,
        };
    }

    // ============================================================
    // VALIDAÇÕES (mesmas do Romaneio)
    // ============================================================

    private async validateCia(ciaId: number) {
        const cia = await s4DotzClient.cia.findUnique({
            where: { id: ciaId },
        });

        if (!cia) {
            throw new AppError("CIA não encontrada", 404);
        }

        if (cia.deletadoEm) {
            throw new AppError("CIA está inativa", 400);
        }

        return cia;
    }

    private async validateUsuarioGrupos(
        usuarioId: number,
        ciaId: number,
        ciaNome: string,
        dataLancamentoContabil: Date
    ) {
        const gruposUsuario = await s4DotzClient.usuarioGrupoUsuario.findMany({
            where: {
                usuarioId,
                grupoUsuario: { ciaId, deletadoEm: null },
            },
            include: { grupoUsuario: true },
        });

        if (gruposUsuario.length === 0) {
            throw new AppError(`Usuário não pertence a nenhum grupo da CIA ${ciaNome}`, 403);
        }

        const dataLancamentoNormalizada = normalizeDateToMidnightUTC(dataLancamentoContabil);

        const hasGrupoValido = gruposUsuario.some((rel: UsuarioGrupoUsuarioRecord) => {
            const dataInicio = normalizeDateToMidnightUTC(rel.grupoUsuario.dataInicio);
            const dataFim = normalizeDateToMidnightUTC(rel.grupoUsuario.dataFim);
            return dataLancamentoNormalizada >= dataInicio && dataLancamentoNormalizada <= dataFim;
        });

        if (!hasGrupoValido) {
            throw new AppError(
                `Nenhum grupo de usuário da CIA "${ciaNome}" está com período contábil válido para a data de lançamento contábil ${formatDateOnly(dataLancamentoContabil)}.`,
                400
            );
        }
    }

    private validateDatas(dataEmissao: Date, dataLancamentoContabil: Date, dataVencimento: Date) {
        const dataAtual = normalizeDateToMidnightUTC(new Date());
        const dataEmissaoNormalizada = normalizeDateToMidnightUTC(dataEmissao);
        const dataLancamentoNormalizada = normalizeDateToMidnightUTC(dataLancamentoContabil);
        const dataVencimentoNormalizada = normalizeDateToMidnightUTC(dataVencimento);

        if (dataEmissaoNormalizada > dataAtual) {
            throw new AppError("Documento com data de emissão futura", 400);
        }

        if (dataLancamentoNormalizada < dataEmissaoNormalizada) {
            throw new AppError("Data contábil menor que data de emissão do documento", 400);
        }

        if (dataVencimentoNormalizada < dataLancamentoNormalizada) {
            throw new AppError("Data de vencimento menor que data contábil do documento", 400);
        }
    }

    private validateFiltros(filtros: any): void {
        const {
            dataEmissaoDe,
            dataEmissaoAte,
            dataVencimentoDe,
            dataVencimentoAte,
            segmento,
        } = filtros;
        const hasPeriodoEmissao = Boolean(dataEmissaoDe && dataEmissaoAte);
        const hasPeriodoVencimento = Boolean(dataVencimentoDe && dataVencimentoAte);

        if (!segmento) {
            throw new AppError("O filtro de parceiro é obrigatório", 400);
        }

        if (!hasPeriodoEmissao && !hasPeriodoVencimento) {
            throw new AppError(
                "Informe um período completo de emissão ou de vencimento",
                400
            );
        }
    }

    private async fetchConfiguracaoContabil(ciaId: number) {
        const configuracao = await s4DotzClient.configuracaoContabil.findFirst({
            where: { ciaId, tipoProcesso: TipoProcesso.TP_POS },
            select: { tipoContabilERP: true },
        });

        if (!configuracao) {
            throw new AppError(
                "Configuração contábil não encontrada para a CIA com processo TP_POS",
                404
            );
        }

        if (!configuracao.tipoContabilERP) {
            throw new AppError(
                "Configuração contábil não possui tipoContabilERP para o tipoDocumentoERP TP_POS",
                400
            );
        }

        return configuracao.tipoContabilERP;
    }

    // ============================================================
    // BUSCAR GRUPO INFO
    // ============================================================
    private async fetchMatrizFilias(where: any): Promise<PosHeaderRow[]> {
        const linhas = await this.rawQueryRepository.findManyHeaders(where);

        if (linhas.length === 0) {
            return [];
        }

        linhas.forEach((linha) => {
            if (!linha.codigoParceiroAnalyzer) {
                throw new AppError(
                    `Código DOTZ não configurado para o parceiro SAP ${linha.codigoParceiroSap}`,
                    400
                );
            }
        });
        return linhas;
    }

    // ============================================================
    // CRIAÇÃO DE DOCUMENTO
    // ============================================================
    private async generateCodigoDocumento(): Promise<string> {
        // Buscar próximo valor da SEQUENCE SeqProtocolo
        const result = await s4DotzClient.$queryRaw<[{ nextVal: bigint }]>`
            SELECT NEXT VALUE FOR SeqProtocolo AS nextVal
        `;

        const sequencial = Number(result[0].nextVal);
        return `TP_POS${sequencial}`;
    }

    private async createDocumento(data: {
        ciaId: number;
        codigoDocumento: string;
        codigoFornecedorSAP: string;
        codigoFornecedorAnalyzer: string;
        dataEmissao: Date;
        dataLancamentoContabil: Date;
        dataVencimento: Date;
        romaneioUrl: string | null;
        usuarioId: number;
        tipoContabilERP: string;
        filtrosPosJson: string;
    }) {
        return s4DotzClient.documentoFiscalHeader.create({
            data: {
                ciaId: data.ciaId,
                codigoFornecedorSAP: data.codigoFornecedorSAP,
                codigoFornecedorAnalyzer: data.codigoFornecedorAnalyzer,
                codigoDocumento: data.codigoDocumento,
                tipoDocumentoERP: TipoProcesso.TP_POS,
                tipoContabilERP: data.tipoContabilERP,
                status: StatusDocumento.AGUARDANDO,
                dataEmissao: data.dataEmissao,
                dataLancamentoContabil: data.dataLancamentoContabil,
                ano: new Date().getFullYear(),
                dataVencimento: data.dataVencimento,
                romaneioUrl: data.romaneioUrl,
                filtrosPosJson: data.filtrosPosJson,
                criadoPor: data.usuarioId,
                atualizadoPor: data.usuarioId,
            },
        });
    }
}
