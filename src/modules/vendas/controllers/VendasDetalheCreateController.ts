import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { VendasDetalheCreateService } from "@/modules/vendas/services/VendasDetalheCreateService";

const optionalString = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .optional()
        .transform((value) => (value === "" ? undefined : value));

const optionalDecimal = () =>
    z
        .union([z.string(), z.number()])
        .optional()
        .transform((value) => {
            if (value === undefined || value === "") {
                return undefined;
            }

            return new Prisma.Decimal(value);
        });

const vendasDetalheCreateParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const vendasDetalheCreateSchema = z.object({
    itemDocumento: z.coerce.number().int().positive().optional(),
    codigoProdutoDotz: z
        .string()
        .trim()
        .min(1, "codigoProdutoDotz é obrigatório")
        .max(20),
    centroLucro: optionalString(20),
    quantidadePontos: z.coerce.number().int().positive().optional(),
    valorVenda: optionalDecimal(),
    precoUnitario: optionalDecimal(),
    custoPontos: optionalDecimal(),
});

export class VendasDetalheCreateController {
    async handle(req: Request, res: Response) {
        const { id: vendasHeaderId } = vendasDetalheCreateParamsSchema.parse(req.params);
        const body = vendasDetalheCreateSchema.parse(req.body);
        const ciaIds = req.user?.ciaIds ?? [];

        const service = new VendasDetalheCreateService();
        const detalhe = await service.execute({
            vendasHeaderId,
            data: body,
            ciaIds,
        });

        return res.status(201).json({
            message: "Detalhe da venda criado com sucesso",
            detalhe,
        });
    }
}
