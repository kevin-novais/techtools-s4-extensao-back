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
import uploadConfig from "@/config/upload";
import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import { publishProcessarDetalhes } from "@/queue/producers/documentoFiscalProducer";
import log from "@/util/logger";
import { formatDocumentoFiscalHeader } from "@/modules/documento-fiscal/utils/formatDocumentoFiscalHeader";
import { Config } from "@/config/config";

interface RomaneioRevalidarParams {
    documentoId: number;
    filename?: string;
    usuarioId: number;
}

const STATUS_PERMITIDOS = new Set<string>([
    StatusDocumento.DIVERGENCIA,
    StatusDocumento.ERRO_PROCESSAMENTO,
    StatusDocumento.ERRO_INTEG,
    StatusDocumento.ERRO_RETORNO_INTEG,
    StatusDocumento.ERRO_ENVIAR_EMAIL,
]);

export class RomaneioRevalidarService {
    private readonly uploadDiskStorageService = new UploadDiskStorageService();

    async execute(params: RomaneioRevalidarParams) {
        if (params.filename) {
            return this.executeComNovaPlanilha(params);
        }

        return this.executeMesmoArquivo(params);
    }

    private async executeComNovaPlanilha(params: RomaneioRevalidarParams) {
        const { documentoId, usuarioId } = params;
        const filename = params.filename;

        if (!filename) {
            throw new AppError("Nome do arquivo temporário não informado", 400);
        }

        let novaRomaneioUrl: string | null = null;

        log.info(`[DocumentoFiscalRevalidarService] Iniciando revalidacao do documento ${documentoId} com nova planilha`);

        try {
            const worksheet = this.readWorksheet(filename);
            validateXlsxColumns(worksheet);

            const documento = await this.validateDocumento(documentoId);
            await this.validateRomaneio(documento.tipoDocumentoERP);

            await this.validateUsuarioAcesso(usuarioId, documento.ciaId, documento.cia.nome);

            // A planilha nova pode conter vários documentos: os demais são ignorados,
            // basta que o documento atual esteja presente nela
            const codigosNovos = extrairCodigosDocumento(worksheet, "NFVENDA");
            this.validateCodigoDocumentoPresente(codigosNovos, documento.codigoDocumento);

            const pedidoParceiro = this.extractPedidoParceiro(worksheet, documento.codigoDocumento);
            await this.validateFornecedor(pedidoParceiro, documento.codigoFornecedorSAP);

            novaRomaneioUrl = await this.uploadDiskStorageService.uploadRomaneio(filename);

            await this.deleteDetalhesAntigos(documentoId);

            const documentoAtualizado = await this.updateDocumento(documentoId, novaRomaneioUrl, usuarioId);

            await this.deleteArquivoAntigoSeNaoCompartilhado(documento.romaneioUrl, documentoId);

            await publishProcessarDetalhes({
                documentoFiscalHeaderId: documentoId,
            });

            log.info(`[DocumentoFiscalRevalidarService] Revalidacao concluida para documento ${documentoId}`);

            return formatDocumentoFiscalHeader(documentoAtualizado);
        } catch (error) {
            await this.handleCleanup(novaRomaneioUrl, filename);

            if (error instanceof AppError) {
                throw error;
            }

            log.error("Erro ao revalidar documento: %o", error);
            throw new AppError("Erro ao revalidar documento", 500);
        }
    }

    private async executeMesmoArquivo(params: RomaneioRevalidarParams) {
        const { documentoId, usuarioId } = params;

        log.info(
            `[DocumentoFiscalRevalidarService] Iniciando revalidacao do documento ${documentoId} reprocessando a mesma planilha armazenada`
        );

        try {
            const documento = await this.validateDocumento(documentoId);
            await this.validateRomaneio(documento.tipoDocumentoERP);

            if (!documento.romaneioUrl || documento.romaneioUrl.trim() === "") {
                throw new AppError(
                    "Documento não possui planilha armazenada. Envie o arquivo novamente para revalidar.",
                    400
                );
            }

            await this.validateUsuarioAcesso(usuarioId, documento.ciaId, documento.cia.nome);

            await this.deleteDetalhesAntigos(documentoId);

            const documentoAtualizado = await this.resetDocumentoParaReprocessamento(documentoId, usuarioId);

            await publishProcessarDetalhes({
                documentoFiscalHeaderId: documentoId,
            });

            log.info(`[DocumentoFiscalRevalidarService] Revalidacao (mesmo arquivo) concluida para documento ${documentoId}`);

            return formatDocumentoFiscalHeader(documentoAtualizado);
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            log.error("Erro ao revalidar documento: %o", error);
            throw new AppError("Erro ao revalidar documento", 500);
        }
    }

    private async validateRomaneio(tipoDocumentoERP: string) {
        if (tipoDocumentoERP !== TipoDocumentoERP.TP_ROM) {
            throw new AppError("Somente documentos do tipo romaneio (TP_ROM) podem ser revalidados por esta rota", 400);
        }
    }

    private async validateDocumento(documentoId: number) {
        const documento = await s4DotzClient.documentoFiscalHeader.findUnique({
            where: { id: documentoId },
            include: {
                cia: { select: { id: true, nome: true } },
            },
        });

        if (!documento) {
            throw new AppError("Documento nao encontrado", 404);
        }

        if (!STATUS_PERMITIDOS.has(documento.status)) {
            throw new AppError(
                `Documento nao pode ser revalidado neste status. Status atual: ${documento.status}`,
                400
            );
        }

        return documento;
    }

    private async validateUsuarioAcesso(usuarioId: number, ciaId: number, ciaNome: string) {
        const gruposUsuario = await s4DotzClient.usuarioGrupoUsuario.findMany({
            where: {
                usuarioId,
                grupoUsuario: { ciaId, deletadoEm: null },
            },
        });

        if (gruposUsuario.length === 0) {
            throw new AppError(`Usuario nao possui acesso a CIA ${ciaNome}`, 403);
        }
    }

    /**
     * A planilha nova precisa conter o documento sendo reprocessado. Outros documentos
     * presentes no arquivo sao ignorados (cada header e' reprocessado separadamente).
     */
    private validateCodigoDocumentoPresente(codigosNovos: string[], codigoDocumentoOriginal: string) {
        const alvo = normalizarCodigoDocumento(codigoDocumentoOriginal);

        if (!codigosNovos.includes(alvo)) {
            throw new AppError(
                `Codigo do documento nao encontrado na planilha. Esperado: ${codigoDocumentoOriginal}, Encontrado(s): ${codigosNovos.join(", ")}`,
                400
            );
        }

        const ignorados = codigosNovos.filter((codigo) => codigo !== alvo);
        if (ignorados.length > 0) {
            log.info(
                `[DocumentoFiscalRevalidarService] Documento ${codigoDocumentoOriginal}: ignorando outro(s) documento(s) da planilha: ${ignorados.join(", ")}`
            );
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
            throw new AppError("Arquivo XLSX nao contem planilhas", 400);
        }

        return workbook.Sheets[sheetName];
    }

    /**
     * Extrai o pedido parceiro das linhas do documento atual, usando a primeira que
     * tenha pedido preenchido. Linhas manuais (bonificacao/desconto) nao tem pedido.
     */
    private extractPedidoParceiro(worksheet: XLSX.WorkSheet, codigoDocumento: string): number {
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        if (data.length === 0) {
            throw new AppError("Planilha nao contem dados", 400);
        }

        const alvo = normalizarCodigoDocumento(codigoDocumento);
        const linhasDoDocumento = data.filter(
            (row) => normalizarCodigoDocumento(row["NFVENDA"]) === alvo
        );

        const linhaComPedido = linhasDoDocumento.find((row) => {
            const pedido = row["PEDIDO_PARCEIRO"];
            return pedido !== undefined && pedido !== null && pedido !== "";
        });

        if (!linhaComPedido) {
            throw new AppError(
                `Documento ${codigoDocumento} nao possui nenhuma linha com PEDIDO_PARCEIRO preenchido`,
                400
            );
        }

        const pedidoParceiroNumero = Number(linhaComPedido["PEDIDO_PARCEIRO"]);

        if (Number.isNaN(pedidoParceiroNumero)) {
            throw new AppError("PEDIDO_PARCEIRO deve ser um numero valido", 400);
        }

        log.info(`[DocumentoFiscalRevalidarService] Pedido parceiro encontrado: ${pedidoParceiroNumero}`);

        return pedidoParceiroNumero;
    }

    private async validateFornecedor(
        pedidoParceiro: number,
        codigoFornecedorSAPOriginal: string
    ): Promise<void> {
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
            throw new AppError(`Pedido parceiro ${pedidoParceiro} nao encontrado na base SAP`, 404);
        }

        if (pedido.CANCELED !== "N") {
            throw new AppError(`Pedido parceiro ${pedidoParceiro} esta cancelado na base SAP`, 400);
        }

        if (!pedido.CardCode) {
            throw new AppError(`Pedido parceiro ${pedidoParceiro} nao possui fornecedor vinculado`, 400);
        }

        if (!pedido.OCRD) {
            throw new AppError(`Fornecedor ${pedido.CardCode} nao encontrado na base SAP`, 404);
        }

        if (pedido.OCRD.U_CODDOTZ === null || pedido.OCRD.U_CODDOTZ === undefined) {
            throw new AppError(`Codigo DOTZ nao configurado para o fornecedor ${pedido.CardCode}`, 400);
        }

        const codigoFornecedorSAP = pedido.CardCode;

        if (codigoFornecedorSAP !== codigoFornecedorSAPOriginal) {
            throw new AppError(
                "Fornecedor do pedido nao corresponde ao fornecedor do documento original",
                400
            );
        }

        log.info(
            `[DocumentoFiscalRevalidarService] Fornecedor validado: ${codigoFornecedorSAP} (igual ao original)`
        );
    }

    private async deleteDetalhesAntigos(documentoId: number): Promise<void> {
        const result = await s4DotzClient.documentoFiscalDetalhe.deleteMany({
            where: { documentoFiscalHeaderId: documentoId },
        });

        log.info(
            `[DocumentoFiscalRevalidarService] ${result.count} detalhes antigos removidos do documento ${documentoId}`
        );
    }

    private async resetDocumentoParaReprocessamento(documentoId: number, usuarioId: number) {
        return s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoId },
            data: {
                status: StatusDocumento.AGUARDANDO,
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
                valorTotalProdutos: null,
                valorTotalPedido: null,
                valorTotalFrete: null,
                valorTotalCombo: null,
                valorTotalIs: null,
                valorTotalCbs: null,
                valorTotalIbsUf: null,
                valorTotalIbsMunicipal: null,
                dataProcessamentoInicio: null,
                dataProcessamentoFim: null,
            },
            include: {
                cia: { select: { id: true, nome: true } },
                criadoPorUsuario: { select: { id: true, nome: true, email: true } },
                atualizadoPorUsuario: { select: { id: true, nome: true, email: true } },
            },
        });
    }

    private async updateDocumento(documentoId: number, novaRomaneioUrl: string, usuarioId: number) {
        return s4DotzClient.documentoFiscalHeader.update({
            where: { id: documentoId },
            data: {
                romaneioUrl: novaRomaneioUrl,
                romaneioFileName: path.basename(novaRomaneioUrl),
                status: StatusDocumento.AGUARDANDO,
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
                valorTotalProdutos: null,
                valorTotalPedido: null,
                valorTotalFrete: null,
                valorTotalCombo: null,
                valorTotalIs: null,
                valorTotalCbs: null,
                valorTotalIbsUf: null,
                valorTotalIbsMunicipal: null,
                dataProcessamentoInicio: null,
                dataProcessamentoFim: null,
            },
            include: {
                cia: { select: { id: true, nome: true } },
                criadoPorUsuario: { select: { id: true, nome: true, email: true } },
                atualizadoPorUsuario: { select: { id: true, nome: true, email: true } },
            },
        });
    }

    /**
     * Remove o arquivo antigo apenas se nenhum outro header ainda o utilizar: um mesmo
     * arquivo de romaneio pode ter gerado varios documentos, e reprocessar um deles nao
     * pode apagar a planilha dos demais.
     */
    private async deleteArquivoAntigoSeNaoCompartilhado(romaneioUrl: string, documentoId: number): Promise<void> {
        try {
            const outrosDocumentos = await s4DotzClient.documentoFiscalHeader.count({
                where: {
                    romaneioUrl,
                    id: { not: documentoId },
                },
            });

            if (outrosDocumentos > 0) {
                log.info(
                    `[DocumentoFiscalRevalidarService] Arquivo antigo mantido: ainda usado por ${outrosDocumentos} documento(s) do mesmo romaneio`
                );
                return;
            }

            const filename = path.basename(romaneioUrl);
            await this.uploadDiskStorageService.cleanupFile(filename, Config.GCS_ROMANEIO_SUBFOLDER);
            log.info(`[DocumentoFiscalRevalidarService] Arquivo antigo removido: ${filename}`);
        } catch (error) {
            log.error("Erro ao remover arquivo antigo: %o", error);
        }
    }

    private async handleCleanup(romaneioUrl: string | null, filename: string) {
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
