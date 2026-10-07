import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { ConfiguracaoContabilDetalhePontoUpdateService } from "@/modules/configuracao-contabil/services/pontos/ConfiguracaoContabilDetalhePontoUpdateService";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

const grupoPisCofinsEnum = z.enum([
    GrupoPisConfinsTypes.S,
    GrupoPisConfinsTypes.N,
]);

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

const configuracaoContabilDetalhePontoUpdateParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    pontoId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalhePontoUpdateSchema = z.object({
    ehPadrao: z.boolean().optional(),
    codigoPonto: nullableString(20),
    descricaoPonto: nullableString(250),
    custoPonto: nullableDecimal(),
    contaCredito: nullableString(20),
    contaDebito: nullableString(20),
    centroCusto: nullableString(20),
    centroLucro: nullableString(20),
    contaCreditoReceitaExpiracao: nullableString(20),
    contaCreditoReceitaVendas: nullableString(20),
    contaCreditoReceitaResgate: nullableString(20),
    grupoPisCofins: grupoPisCofinsEnum.optional(),
    aliquotaPis: nullableDecimal(),
    aliquotaCofins: nullableDecimal(),
    contaCreditoPis: nullableString(20),
    contaDebitoPis: nullableString(20),
    contaCreditoCofins: nullableString(20),
    contaDebitoCofins: nullableString(20),
}).refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Informe ao menos um campo para atualizar" },
);

export class ConfiguracaoContabilDetalhePontoUpdateController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, pontoId } = configuracaoContabilDetalhePontoUpdateParamsSchema.parse(req.params);
        const body = configuracaoContabilDetalhePontoUpdateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const updateService = new ConfiguracaoContabilDetalhePontoUpdateService();
        const ponto = await updateService.execute({
            configuracaoContabilId,
            pontoId,
            data: body,
            usuarioId,
        });

        return res.status(200).json({
            message: "Ponto da configuração contábil atualizado com sucesso",
            ponto,
        });
    }
}
