import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { VendasDetalheUpdateService } from "@/modules/vendas/services/VendasDetalheUpdateService";

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

const vendasDetalheUpdateParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

const vendasDetalheUpdateSchema = z
    .object({
        itemDocumento: z.coerce.number().int().positive().optional(),
        item_documento: z.coerce.number().int().positive().optional(),
        codigoProdutoDotz: z.string().trim().min(1).max(20).optional(),
        centroLucro: nullableString(20),
        quantidadePontos: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
        valorVenda: nullableDecimal(),
        precoUnitario: nullableDecimal(),
        custoPontos: nullableDecimal(),
    })
    .transform(({ item_documento, itemDocumento, ...rest }) => ({
        ...rest,
        itemDocumento: itemDocumento ?? item_documento,
    }))
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "Informe ao menos um campo para atualizar",
    });

export class VendasDetalheUpdateController {
    async handle(req: Request, res: Response) {
        const { id: vendasHeaderId, detalheId } = vendasDetalheUpdateParamsSchema.parse(
            req.params,
        );
        const body = vendasDetalheUpdateSchema.parse(req.body);
        const ciaIds = req.user?.ciaIds ?? [];

        const service = new VendasDetalheUpdateService();
        const detalhe = await service.execute({
            vendasHeaderId,
            detalheId,
            data: body,
            ciaIds,
        });

        return res.status(200).json({
            message: "Detalhe da venda atualizado com sucesso",
            detalhe,
        });
    }
}
