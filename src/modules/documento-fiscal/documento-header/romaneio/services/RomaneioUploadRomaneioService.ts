import * as XLSX from "xlsx";
import path from "node:path";
import s4DotzClient from "@/database/clients/s4DotzClient";
import getDotzStageClient from "@/database/clients/dotzStageClient";
import AppError from "@/util/AppError";
import { UploadDiskStorageService } from "@/util/services/upload.service";
import { validateXlsxColumns } from "@/modules/documento-fiscal/utils/validateXlsxColumns";
import {
    extrairCodigosDocumento,
    normalizarCodigoDocumento,
} from "@/modules/documento-fiscal/utils/codigosDocumentoRomaneio";
import { Prisma } from "@prisma/client-s4-dotz";
import uploadConfig from "@/config/upload";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { formatDateToBrazilianTimezone, normalizeDateToMidnightUTC, formatDateOnly } from "@/util/date";
import { publishProcessarDetalhes } from "@/queue/producers/documentoFiscalProducer";
import log from "@/util/logger";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";
import { Config } from "@/config/config";

interface UsuarioGrupoUsuarioRecord {
    grupoUsuario: {
        dataInicio: Date;
        dataFim: Date;
    };
}

interface RomaneioUploadRomaneioParams {
    ciaId: number;
    dataEmissao: Date;
    dataLancamentoContabil: Date;
    dataVencimento: Date;
    filename: string;
    nomeRomaneio: string;
    usuarioId: number;
}

interface DocumentoBarrado {
    codigoDocumento: string;
    status: string;
    motivo: string;
}

export class RomaneioUploadRomaneioService {
    private readonly uploadDiskStorageService = new UploadDiskStorageService();

    async execute(params: RomaneioUploadRomaneioParams) {
        const { ciaId, dataEmissao, dataLancamentoContabil, dataVencimento, filename, usuarioId } = params;
        let romaneioUrl: string | null = null;
        let documentosCriadosIds: number[] = [];

        log.info(`[DocumentoFiscalUploadRomaneioService] Iniciando processo de upload de romaneio para CIA ${ciaId}`);

        try {
            const cia = await this.validateCia(ciaId);
            const tipoContabilERP = await this.fetchConfiguracaoContabil(ciaId);
            await this.validateUsuarioGrupos(usuarioId, ciaId, cia.nome, dataLancamentoContabil);
            this.validateDatas(dataEmissao, dataLancamentoContabil, dataVencimento);

            const worksheet = this.readWorksheet(filename);
            validateXlsxColumns(worksheet);

            // Um arquivo pode conter vários documentos (coluna NFVENDA): um header por código
            const codigos = extrairCodigosDocumento(worksheet, "NFVENDA");

            const { codigosParaCriar, barrados } = await this.separarDocumentosJaCadastrados(ciaId, codigos);

            if (codigosParaCriar.length === 0) {
                throw new AppError(
                    `Nenhum documento novo no arquivo. Já cadastrado(s): ${barrados
                        .map((b) => b.codigoDocumento)
                        .join(", ")}`,
                    400
                );
            }

            // Fornecedor é derivado por documento, a partir dos pedidos daquele documento
            const fornecedoresPorCodigo = await this.resolverFornecedores(worksheet, codigosParaCriar);

            romaneioUrl = await this.uploadDiskStorageService.uploadRomaneio(filename);

            const documentosCriados = await this.createDocumentos({
                ciaId,
                codigos: codigosParaCriar,
                fornecedoresPorCodigo,
                dataEmissao,
                dataLancamentoContabil,
                dataVencimento,
                romaneioUrl,
                usuarioId,
                tipoContabilERP,
                nomeRomaneio: params.nomeRomaneio,
            });
            documentosCriadosIds = documentosCriados.map((documento: { id: number }) => documento.id);

            const response = {
                criados: documentosCriados.map((documento: any) => this.formatResponse(documento)),
                barrados,
            };

            // Publicar uma mensagem por documento para processar detalhes
            for (const documento of documentosCriados) {
                await publishProcessarDetalhes({
                    documentoFiscalHeaderId: documento.id,
                });
            }

            log.info(
                `[DocumentoFiscalUploadRomaneioService] ${documentosCriados.length} documento(s) criado(s), ${barrados.length} barrado(s)`
            );

            return response;
        } catch (error) {
            await this.handleCleanup(romaneioUrl, filename, documentosCriadosIds);

            if (error instanceof AppError) {
                throw error;
            }

            log.error("Erro ao enviar romaneio: %o", error);
            throw new AppError("Erro ao enviar romaneio", 500);
        }
    }

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

    private readWorksheet(filename: string): XLSX.WorkSheet {
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, filename);

        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.readFile(tmpPath);
        } catch (error) {
            log.error("Erro ao ler arquivo XLSX: %o", error);
            throw new AppError("Erro ao ler arquivo XLSX", 400);
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            throw new AppError("Arquivo XLSX não contém planilhas", 400);
        }

        return workbook.Sheets[sheetName];
    }

    /**
     * Separa os códigos do arquivo entre os que serão criados e os barrados por já
     * existirem (inclui os já integrados). Uma única query para todos os códigos.
     */
    private async separarDocumentosJaCadastrados(
        ciaId: number,
        codigos: string[]
    ): Promise<{ codigosParaCriar: string[]; barrados: DocumentoBarrado[] }> {
        const existentes = await s4DotzClient.documentoFiscalHeader.findMany({
            where: {
                ciaId,
                tipoDocumentoERP: TipoProcesso.TP_ROM,
                codigoDocumento: { in: codigos },
            },
            select: { codigoDocumento: true, status: true, codigoDocumentoERP: true },
        });

        const barrados: DocumentoBarrado[] = existentes.map((documento: {
            codigoDocumento: string;
            status: string;
            codigoDocumentoERP: string | null;
        }) => ({
            codigoDocumento: documento.codigoDocumento,
            status: documento.status,
            motivo: documento.codigoDocumentoERP
                ? `Documento ${documento.codigoDocumento} já está integrado no SAP (Doc. ${documento.codigoDocumentoERP})`
                : `Documento ${documento.codigoDocumento} já foi cadastrado (status ${documento.status})`,
        }));

        const codigosBarrados = new Set(barrados.map((b) => b.codigoDocumento));
        const codigosParaCriar = codigos.filter((codigo) => !codigosBarrados.has(codigo));

        if (barrados.length > 0) {
            log.warn(
                `[DocumentoFiscalUploadRomaneioService] Documento(s) barrado(s): ${barrados
                    .map((b) => b.motivo)
                    .join(" | ")}`
            );
        }

        return { codigosParaCriar, barrados };
    }

    /**
     * Resolve o fornecedor de cada documento a partir do primeiro pedido daquele
     * documento. Linhas manuais (bonificação/desconto) não têm pedido e são ignoradas
     * nessa busca.
     */
    private async resolverFornecedores(
        worksheet: XLSX.WorkSheet,
        codigos: string[]
    ): Promise<Map<string, { codigoFornecedorSAP: string; codigoFornecedorAnalyzer: string }>> {
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        const fornecedores = new Map<string, { codigoFornecedorSAP: string; codigoFornecedorAnalyzer: string }>();

        for (const codigo of codigos) {
            const linhasDoDocumento = data.filter(
                (row) => normalizarCodigoDocumento(row["NFVENDA"]) === codigo
            );

            const pedidoParceiro = this.extractPedidoParceiro(linhasDoDocumento, codigo);
            fornecedores.set(codigo, await this.validateFornecedor(pedidoParceiro));
        }

        return fornecedores;
    }

    private async fetchConfiguracaoContabil(ciaId: number) {
        const configuracao = await s4DotzClient.configuracaoContabil.findFirst({
            where: { ciaId, tipoProcesso: TipoProcesso.TP_ROM },
            select: { tipoContabilERP: true },
        });

        if (!configuracao) {
            throw new AppError("Configuração contábil não encontrada para a CIA com processo TP_ROM", 404);
        }

        if (!configuracao.tipoContabilERP) {
            throw new AppError("Configuração contábil não possui tipoContabilERP para o tipoDocumentoERP TP_ROM", 400);
        }

        return configuracao.tipoContabilERP;
    }

    /**
     * Extrai o pedido parceiro de um documento, usando a primeira linha que tenha
     * pedido preenchido. Linhas manuais (bonificação/desconto) não têm pedido.
     */
    private extractPedidoParceiro(linhasDoDocumento: Record<string, any>[], codigoDocumento: string): number {
        if (linhasDoDocumento.length === 0) {
            throw new AppError(`Documento ${codigoDocumento} não contém linhas`, 400);
        }

        const linhaComPedido = linhasDoDocumento.find((row) => {
            const pedido = row["PEDIDO_PARCEIRO"];
            return pedido !== undefined && pedido !== null && pedido !== "";
        });

        if (!linhaComPedido) {
            throw new AppError(
                `Documento ${codigoDocumento} não possui nenhuma linha com PEDIDO_PARCEIRO preenchido`,
                400
            );
        }

        const pedidoParceiroNumero = Number(linhaComPedido["PEDIDO_PARCEIRO"]);

        if (Number.isNaN(pedidoParceiroNumero)) {
            throw new AppError(
                `PEDIDO_PARCEIRO deve ser um número válido (documento ${codigoDocumento})`,
                400
            );
        }

        log.info(
            `[extractPedidoParceiro] Documento ${codigoDocumento}: pedido parceiro ${pedidoParceiroNumero}`
        );

        return pedidoParceiroNumero;
    }

    private async validateFornecedor(pedidoParceiro: number): Promise<{
        codigoFornecedorSAP: string;
        codigoFornecedorAnalyzer: string;
    }> {
        const dotzStageClient = getDotzStageClient();

        const pedido = await dotzStageClient.oPOR.findFirst({
            where: { U_DOTZNRPED: pedidoParceiro },
            select: {
                CardCode: true,
                CANCELED: true,
                OCRD: {
                    select: { U_CODDOTZ: true },
                },
            },
        });

        if (!pedido) {
            throw new AppError(`Pedido parceiro ${pedidoParceiro} não encontrado na base SAP`, 404);
        }

        if (pedido.CANCELED !== "N") {
            throw new AppError(`Pedido parceiro ${pedidoParceiro} está cancelado na base SAP`, 400);
        }

        if (!pedido.CardCode) {
            throw new AppError(`Pedido parceiro ${pedidoParceiro} não possui fornecedor vinculado`, 400);
        }

        if (!pedido.OCRD) {
            throw new AppError(`Fornecedor ${pedido.CardCode} não encontrado na base SAP`, 404);
        }

        if (pedido.OCRD.U_CODDOTZ === null || pedido.OCRD.U_CODDOTZ === undefined) {
            throw new AppError(`Código DOTZ não configurado para o fornecedor ${pedido.CardCode}`, 400);
        }

        const codigoFornecedorSAP = pedido.CardCode;
        const codigoFornecedorAnalyzer = String(pedido.OCRD.U_CODDOTZ);

        log.info(`[validateFornecedor] Fornecedor SAP: ${codigoFornecedorSAP}, Analyzer: ${codigoFornecedorAnalyzer}`);

        return { codigoFornecedorSAP, codigoFornecedorAnalyzer };
    }

    /**
     * Cria um header por código de documento, numa única transação: se qualquer um
     * falhar, nenhum é criado (evita romaneio importado pela metade).
     */
    private async createDocumentos(data: {
        ciaId: number;
        codigos: string[];
        fornecedoresPorCodigo: Map<string, { codigoFornecedorSAP: string; codigoFornecedorAnalyzer: string }>;
        dataEmissao: Date;
        dataLancamentoContabil: Date;
        dataVencimento: Date;
        romaneioUrl: string;
        usuarioId: number;
        tipoContabilERP: string;
        nomeRomaneio: string;
    }) {
        return s4DotzClient.$transaction(async (tx: Prisma.TransactionClient) => {
            const documentos = [];

            for (const codigoDocumento of data.codigos) {
                const fornecedor = data.fornecedoresPorCodigo.get(codigoDocumento)!;

                const documento = await tx.documentoFiscalHeader.create({
                    data: {
                        ciaId: data.ciaId,
                        codigoFornecedorSAP: fornecedor.codigoFornecedorSAP,
                        codigoFornecedorAnalyzer: fornecedor.codigoFornecedorAnalyzer,
                        codigoDocumento,
                        tipoDocumentoERP: TipoProcesso.TP_ROM,
                        tipoContabilERP: data.tipoContabilERP,
                        status: StatusDocumento.AGUARDANDO,
                        dataEmissao: data.dataEmissao,
                        dataLancamentoContabil: data.dataLancamentoContabil,
                        ano: new Date().getFullYear(),
                        dataVencimento: data.dataVencimento,
                        romaneioUrl: data.romaneioUrl,
                        romaneioFileName: path.basename(data.romaneioUrl),
                        nomeRomaneio: data.nomeRomaneio,
                        criadoPor: data.usuarioId,
                        atualizadoPor: data.usuarioId,
                    },
                    include: {
                        cia: { select: { id: true, nome: true } },
                    },
                });

                documentos.push(documento);
            }

            return documentos;
        });
    }

    private formatResponse(documento: any) {
        return {
            id: documento.id,
            nomeRomaneio: documento.nomeRomaneio,
            ciaId: documento.ciaId,
            codigoFornecedorSAP: documento.codigoFornecedorSAP,
            codigoFornecedorAnalyzer: documento.codigoFornecedorAnalyzer,
            codigoDocumento: documento.codigoDocumento,
            tipoDocumentoERP: documento.tipoDocumentoERP,
            tipoContabilERP: documento.tipoContabilERP,
            status: documento.status,
            dataEmissao: formatDateOnly(documento.dataEmissao),
            dataLancamentoContabil: formatDateOnly(documento.dataLancamentoContabil),
            dataVencimento: formatDateOnly(documento.dataVencimento),
            romaneioUrl: documento.romaneioUrl,
            romaneioFileName: documento.romaneioFileName,
            criadoPor: documento.criadoPor,
            criadoEm: formatDateToBrazilianTimezone(documento.criadoEm),
            atualizadoPor: documento.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(documento.atualizadoEm),
            cia: documento.cia,
        };
    }

    private async handleCleanup(romaneioUrl: string | null, filename: string, documentoIds: number[] = []) {
        if (documentoIds.length > 0) {
            try {
                await s4DotzClient.documentoFiscalHeader.deleteMany({ where: { id: { in: documentoIds } } });
            } catch (deleteError) {
                log.error("Erro ao remover documentos do banco após falha no envio: %o", deleteError);
            }
        }

        if (!romaneioUrl) {
            try {
                await this.uploadDiskStorageService.cleanupTmpFile(filename);
            } catch (cleanupError) {
                log.error("Erro ao limpar arquivo da tmp: %o", cleanupError);
            }
            return;
        }

        try {
            await this.uploadDiskStorageService.cleanupFile(path.basename(romaneioUrl), Config.GCS_ROMANEIO_SUBFOLDER);
        } catch (cleanupError) {
            log.error("Erro ao fazer cleanup do arquivo: %o", cleanupError);
        }
    }
}

