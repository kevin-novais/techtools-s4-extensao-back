import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { parseDateAsBrazilian } from "@/util/date";
import { VendasCreateService } from "@/modules/vendas/services/VendasCreateService";
import { VendasAnexosStorageService } from "@/modules/vendas/services/VendasAnexosStorageService";
import { getVendasAnexos } from "@/modules/vendas/utils/getVendasAnexos";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateField = (label: string) =>
    z
        .string()
        .regex(dateRegex, `${label} deve estar no formato YYYY-MM-DD`)
        .refine((val) => !Number.isNaN(Date.parse(val)), {
            message: `${label} inválida`,
        });

const optionalDateField = (label: string) =>
    z.preprocess(
        (value) => (value === "" ? undefined : value),
        dateField(label).optional(),
    );

const optionalString = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullish()
        .transform((value) => {
            if (value == null || value === "") return undefined;
            return value;
        });

const requiredString = (field: string, max: number) =>
    z
        .string()
        .trim()
        .min(1, `${field} é obrigatório`)
        .max(max);

const optionalDecimal = () =>
    z
        .union([z.string(), z.number(), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined || value === null || value === "") {
                return undefined;
            }

            return new Prisma.Decimal(value);
        });

const vendasCreateSchema = z.object({
    ciaId: z.coerce.number().int().positive(),
    codigoClienteSAP: optionalString(50),
    codigoClienteAnalyzer: requiredString("codigoClienteAnalyzer", 50),
    cnpjCliente: requiredString("cnpjCliente", 20),
    numeroDocumentoAnalyzer: requiredString("numeroDocumentoAnalyzer", 50),
    infoReferenciaAnalyzer: optionalString(4000),
    valorTotalVendas: optionalDecimal(),
    dataEmissao: dateField("Data de emissão"),
    dataLancamentoContabil: dateField("Data de lançamento contábil"),
    dataVencimento: optionalDateField("Data de vencimento"),
});

export class VendasCreateController {
    async handle(req: Request, res: Response) {
        const anexos = getVendasAnexos(req.files);
        const anexosStorageService = new VendasAnexosStorageService();

        try {
            const body = vendasCreateSchema.parse(req.body);
            const ciaIds = req.user?.ciaIds ?? [];

            const service = new VendasCreateService(anexosStorageService);
            const venda = await service.execute({
                data: {
                    ciaId: body.ciaId,
                    codigoClienteAnalyzer: body.codigoClienteAnalyzer,
                    cnpjCliente: body.cnpjCliente,
                    codigoClienteSAP: body.codigoClienteSAP,
                    numeroDocumentoAnalyzer: body.numeroDocumentoAnalyzer,
                    infoReferenciaAnalyzer: body.infoReferenciaAnalyzer,
                    valorTotalVendas: body.valorTotalVendas,
                    dataEmissao: parseDateAsBrazilian(body.dataEmissao),
                    dataLancamentoContabil: parseDateAsBrazilian(body.dataLancamentoContabil),
                    dataVencimento: body.dataVencimento
                        ? parseDateAsBrazilian(body.dataVencimento)
                        : undefined,
                },
                anexos,
                ciaIds,
            });

            return res.status(201).json({
                message: "Venda criada com sucesso",
                venda,
            });
        } finally {
            await anexosStorageService.cleanupTemporaryFiles(anexos);
        }
    }
}
