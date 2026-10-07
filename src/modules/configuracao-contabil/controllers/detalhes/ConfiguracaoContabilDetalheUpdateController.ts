import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { ConfiguracaoContabilDetalheUpdateService } from "@/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheUpdateService";
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

const configuracaoContabilDetalheUpdateParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
    detalheId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalheUpdateSchema = z.object({
    codigoItem: nullableString(20),
    grupoPisCofins: grupoPisCofinsEnum.optional(),
    validarDivergencia: z.boolean().optional(),
    aliquotaPis: nullableDecimal(),
    aliquotaCofins: nullableDecimal(),
    contaCreditoPis: nullableString(20),
    contaDebitoPis: nullableString(20),
    contaCreditoCofins: nullableString(20),
    contaDebitoCofins: nullableString(20),
    contaCreditoValorProduto: nullableString(20),
    contaDebitoValorProduto: nullableString(20),
    contaCreditoValorFrete: nullableString(20),
    contaDebitoValorFrete: nullableString(20),
    contaCreditoValorCombo: nullableString(20),
    contaDebitoValorCombo: nullableString(20),
    contaCreditoValorIs: nullableString(20),
    contaDebitoValorIs: nullableString(20),
    contaCreditoValorCbs: nullableString(20),
    contaDebitoValorCbs: nullableString(20),
    contaCreditoValorIbsUf: nullableString(20),
    contaDebitoValorIbsUf: nullableString(20),
    contaCreditoValorIbsMunicipal: nullableString(20),
    contaDebitoValorIbsMunicipal: nullableString(20),
    centroCusto: nullableString(20),
    centroLucro: nullableString(20),
}).refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Informe ao menos um campo para atualizar" },
);

export class ConfiguracaoContabilDetalheUpdateController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId, detalheId } = configuracaoContabilDetalheUpdateParamsSchema.parse(req.params);
        const body = configuracaoContabilDetalheUpdateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const updateService = new ConfiguracaoContabilDetalheUpdateService();
        const detalhe = await updateService.execute({
            configuracaoContabilId,
            detalheId,
            data: body,
            usuarioId,
        });

        return res.status(200).json({
            message: "Detalhe da configuração contábil atualizado com sucesso",
            detalhe,
        });
    }
}
