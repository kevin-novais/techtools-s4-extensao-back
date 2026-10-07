import { Request, Response } from "express";
import { z } from "zod";

import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { parseDateForFilter, parseDateForFilterEnd } from "@/util/date";
import { VendasListService } from "@/modules/vendas/services/VendasListService";

const statusVendasSchema = z.enum([
    StatusVendas.CADASTRO,
    StatusVendas.PENDENTE,
    StatusVendas.AGUARDANDO,
    StatusVendas.PROCESSANDO,
    StatusVendas.ERRO_PROC,
    StatusVendas.ERRO_FATURA,
    StatusVendas.INTEG_SAP,
    StatusVendas.ERRO_INTEG_SAP,
    StatusVendas.AGUARDANDO_BOLETO,
    StatusVendas.ERRO_BOLETO,
    StatusVendas.ENVIANDO_EMAIL,
    StatusVendas.ERRO_EMAIL,
    StatusVendas.CONCLUIDO,
]);

const VendasListQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    filterModel: z.string().trim().optional(),
    sortModel: z.string().trim().optional(),
    id: z.coerce.number().int().positive().optional(),
    ciaId: z.coerce.number().int().positive().optional(),
    status: statusVendasSchema.optional(),
    codigoClienteSAP: z.string().trim().optional(),
    numeroDocumentoAnalyzer: z.string().trim().optional(),
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

export class VendasListController {
    async handle(req: Request, res: Response) {
        const ciaIds = req.user?.ciaIds || [];
        const queryParams = VendasListQuerySchema.parse(req.query);

        const vendasListService = new VendasListService();
        const result = await vendasListService.execute({
            ciaIds,
            page: queryParams.page,
            limit: queryParams.limit,
            filterModel: queryParams.filterModel,
            sortModel: queryParams.sortModel,
            id: queryParams.id,
            ciaId: queryParams.ciaId,
            status: queryParams.status,
            codigoClienteSAP: queryParams.codigoClienteSAP,
            numeroDocumentoAnalyzer: queryParams.numeroDocumentoAnalyzer,
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
