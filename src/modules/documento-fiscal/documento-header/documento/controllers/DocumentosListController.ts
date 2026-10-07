import { Request, Response } from "express";
import { z } from "zod";

import { StatusDocumento } from "@/@types/DocumentoFiscalHeader/StatusDocumentoTypes";
import { TipoDocumentoERP } from "@/@types/DocumentoFiscalHeader/TipoDocumentoTypes";
import { parseDateForFilter, parseDateForFilterEnd } from "@/util/date";
import { DocumentoListService } from "../services/DocumentosListService";

const statusDocumentoSchema = z.enum([
    StatusDocumento.AGUARDANDO,
    StatusDocumento.PROCESSANDO,
    StatusDocumento.ERRO_PROCESSAMENTO,
    StatusDocumento.APROVADO,
    StatusDocumento.REPROVADO,
    StatusDocumento.DIVERGENCIA,
    StatusDocumento.INTEGRADO,
    StatusDocumento.ERRO_INTEG,
    StatusDocumento.RETORNO_INTEG,
    StatusDocumento.ERRO_RETORNO_INTEG,
    StatusDocumento.ENVIAR_EMAIL,
    StatusDocumento.ERRO_ENVIAR_EMAIL,
    StatusDocumento.PROCESSADO,
]);

const tipoDocumentoERPSchema = z.enum([
    TipoDocumentoERP.TP_ROM,
    TipoDocumentoERP.TP_POS,
    TipoDocumentoERP.DR,
    TipoDocumentoERP.PD,
    TipoDocumentoERP.RD,
]);

const DocumentoListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    ciaId: z.coerce.number().int().positive().optional(),
    ciaNome: z.string().optional(),
    status: statusDocumentoSchema.optional(),
    codigoFornecedorSAP: z.string().trim().optional(),
    tipoDocumentoERP: tipoDocumentoERPSchema.optional(),
    codigoDocumento: z.string().trim().optional(),
    criadoPor: z.coerce.number().int().positive().optional(),
    atualizadoPor: z.coerce.number().int().positive().optional(),
    dataEmissaoInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de emissão início inválida",
        }),
    dataEmissaoFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de emissão fim inválida",
        }),
    dataLancamentoContabilInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de lançamento contábil início inválida",
        }),
    dataLancamentoContabilFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de lançamento contábil fim inválida",
        }),
    dataProcessamentoInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de processamento início inválida",
        }),
    dataProcessamentoFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de processamento fim inválida",
        }),
    dataIntegracaoInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de integração início inválida",
        }),
    dataIntegracaoFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de integração fim inválida",
        }),
    criadoEmInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de criação início inválida",
        }),
    criadoEmFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de criação fim inválida",
        }),
    atualizadoEmInicio: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de atualização início inválida",
        }),
    atualizadoEmFim: z
        .string()
        .optional()
        .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
            message: "Data de atualização fim inválida",
        }),
});

export class DocumentoListController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const queryParams = DocumentoListQuerySchema.parse(req.query);

        const documentoListService = new DocumentoListService();
        const result = await documentoListService.execute({
            ciaIds,
            page: queryParams.page,
            limit: queryParams.limit,
            filterModel: queryParams.filterModel,
            sortModel: queryParams.sortModel,
            id: queryParams.id,
            ciaId: queryParams.ciaId,
            ciaNome: queryParams.ciaNome,
            status: queryParams.status,
            tipoDocumentoERP: queryParams.tipoDocumentoERP,
            codigoFornecedorSAP: queryParams.codigoFornecedorSAP,
            codigoDocumento: queryParams.codigoDocumento,
            criadoPor: queryParams.criadoPor,
            atualizadoPor: queryParams.atualizadoPor,
            dataEmissaoInicio: queryParams.dataEmissaoInicio
                ? parseDateForFilter(queryParams.dataEmissaoInicio)
                : undefined,
            dataEmissaoFim: queryParams.dataEmissaoFim
                ? parseDateForFilterEnd(queryParams.dataEmissaoFim)
                : undefined,
            dataLancamentoContabilInicio: queryParams.dataLancamentoContabilInicio
                ? parseDateForFilter(queryParams.dataLancamentoContabilInicio)
                : undefined,
            dataLancamentoContabilFim: queryParams.dataLancamentoContabilFim
                ? parseDateForFilterEnd(queryParams.dataLancamentoContabilFim)
                : undefined,
            dataProcessamentoInicio: queryParams.dataProcessamentoInicio
                ? parseDateForFilter(queryParams.dataProcessamentoInicio)
                : undefined,
            dataProcessamentoFim: queryParams.dataProcessamentoFim
                ? parseDateForFilterEnd(queryParams.dataProcessamentoFim)
                : undefined,
            dataIntegracaoInicio: queryParams.dataIntegracaoInicio
                ? parseDateForFilter(queryParams.dataIntegracaoInicio)
                : undefined,
            dataIntegracaoFim: queryParams.dataIntegracaoFim
                ? parseDateForFilterEnd(queryParams.dataIntegracaoFim)
                : undefined,
            criadoEmInicio: queryParams.criadoEmInicio
                ? parseDateForFilter(queryParams.criadoEmInicio)
                : undefined,
            criadoEmFim: queryParams.criadoEmFim
                ? parseDateForFilterEnd(queryParams.criadoEmFim)
                : undefined,
            atualizadoEmInicio: queryParams.atualizadoEmInicio
                ? parseDateForFilter(queryParams.atualizadoEmInicio)
                : undefined,
            atualizadoEmFim: queryParams.atualizadoEmFim
                ? parseDateForFilterEnd(queryParams.atualizadoEmFim)
                : undefined,
        });

        return res.status(200).json(result);
    }
}

