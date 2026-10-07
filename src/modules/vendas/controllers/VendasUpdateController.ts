import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { parseDateAsBrazilian } from "@/util/date";
import { VendasUpdateService } from "@/modules/vendas/services/VendasUpdateService";
import AppError from "@/util/AppError";
import { VendasAnexosStorageService } from "@/modules/vendas/services/VendasAnexosStorageService";
import { getVendasAnexos } from "@/modules/vendas/utils/getVendasAnexos";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateField = (label: string) =>
    z
        .string()
        .regex(dateRegex, `${label} deve estar no formato YYYY-MM-DD`)
        .refine((val) => !Number.isNaN(Date.parse(val)), {
            message: `${label} inválida`,
        })
        .optional();

const nullableString = (max: number) =>
    z
        .union([z.string().trim().max(max), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined) {
                return undefined;
            }

            if (value === null) {
                return null;
            }

            return value === "" ? null : value;
        });

const nullableDecimal = () =>
    z
        .union([z.string(), z.number(), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined) {
                return undefined;
            }

            if (value === null || value === "") {
                return null;
            }

            return new Prisma.Decimal(value);
        });

const vendasUpdateParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const vendasUpdateSchema = z
    .object({
        codigoClienteSAP: nullableString(50),
        codigoClienteAnalyzer: nullableString(50),
        numeroDocumentoAnalyzer: nullableString(50),
        infoReferenciaAnalyzer: nullableString(4000),
        valorTotalVendas: nullableDecimal(),
        dataEmissao: dateField("Data de emissão"),
        dataLancamentoContabil: dateField("Data de lançamento contábil"),
        dataVencimento: dateField("Data de vencimento"),
    });

export class VendasUpdateController {
    async handle(req: Request, res: Response) {
        const anexos = getVendasAnexos(req.files);
        const anexosStorageService = new VendasAnexosStorageService();

        try {
            const { id } = vendasUpdateParamsSchema.parse(req.params);
            const body = vendasUpdateSchema.parse(req.body);
            const ciaIds = req.user?.ciaIds ?? [];
            const hasBodyField = Object.values(body).some(
                (value) => value !== undefined,
            );
            const hasAnexo = Object.values(anexos).some(Boolean);

            if (!hasBodyField && !hasAnexo) {
                throw new AppError("Informe ao menos um campo para atualizar", 400);
            }

            const service = new VendasUpdateService(anexosStorageService);
            const venda = await service.execute({
                id,
                data: {
                    codigoClienteAnalyzer: body.codigoClienteAnalyzer,
                    codigoClienteSAP: body.codigoClienteSAP,
                    numeroDocumentoAnalyzer: body.numeroDocumentoAnalyzer,
                    infoReferenciaAnalyzer: body.infoReferenciaAnalyzer,
                    valorTotalVendas: body.valorTotalVendas,
                    dataEmissao: body.dataEmissao
                        ? parseDateAsBrazilian(body.dataEmissao)
                        : undefined,
                    dataLancamentoContabil: body.dataLancamentoContabil
                        ? parseDateAsBrazilian(body.dataLancamentoContabil)
                        : undefined,
                    dataVencimento: body.dataVencimento
                        ? parseDateAsBrazilian(body.dataVencimento)
                        : undefined,
                },
                anexos,
                ciaIds,
            });

            return res.status(200).json({
                message: "Venda atualizada com sucesso",
                venda,
            });
        } finally {
            await anexosStorageService.cleanupTemporaryFiles(anexos);
        }
    }
}
