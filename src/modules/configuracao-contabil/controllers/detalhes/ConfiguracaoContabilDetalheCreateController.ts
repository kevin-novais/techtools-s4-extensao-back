import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { ConfiguracaoContabilDetalheCreateService } from "@/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheCreateService";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

const grupoPisCofinsEnum = z.enum([
    GrupoPisConfinsTypes.S,
    GrupoPisConfinsTypes.N,
]);

const optionalString = (max: number) =>
    z
        .union([z.string().trim().max(max), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined || value === null || value === "") {
                return undefined;
            }
            return value;
        });

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

const configuracaoContabilDetalheCreateParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalheCreateSchema = z.object({
    codigoItem: optionalString(20),
    grupoPisCofins: grupoPisCofinsEnum,
    validarDivergencia: z.boolean().optional().default(true),
    aliquotaPis: optionalDecimal(),
    aliquotaCofins: optionalDecimal(),
    contaCreditoPis: optionalString(20),
    contaDebitoPis: optionalString(20),
    contaCreditoCofins: optionalString(20),
    contaDebitoCofins: optionalString(20),
    contaCreditoValorProduto: optionalString(20),
    contaDebitoValorProduto: optionalString(20),
    contaCreditoValorFrete: optionalString(20),
    contaDebitoValorFrete: optionalString(20),
    contaCreditoValorCombo: optionalString(20),
    contaDebitoValorCombo: optionalString(20),
    contaCreditoValorIs: optionalString(20),
    contaDebitoValorIs: optionalString(20),
    contaCreditoValorCbs: optionalString(20),
    contaDebitoValorCbs: optionalString(20),
    contaCreditoValorIbsUf: optionalString(20),
    contaDebitoValorIbsUf: optionalString(20),
    contaCreditoValorIbsMunicipal: optionalString(20),
    contaDebitoValorIbsMunicipal: optionalString(20),
    centroCusto: optionalString(20),
    centroLucro: optionalString(20),
}).refine(
    (data) => {
        if (data.grupoPisCofins !== GrupoPisConfinsTypes.S) return true;
        return data.aliquotaPis != null && data.aliquotaCofins != null;
    },
    { message: "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios" },
);

export class ConfiguracaoContabilDetalheCreateController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId } = configuracaoContabilDetalheCreateParamsSchema.parse(req.params);
        const body = configuracaoContabilDetalheCreateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const createService = new ConfiguracaoContabilDetalheCreateService();
        const detalhe = await createService.execute({
            configuracaoContabilId,
            data: body,
            usuarioId,
        });

        return res.status(201).json({
            message: "Detalhe da configuração contábil criado com sucesso",
            detalhe,
        });
    }
}
