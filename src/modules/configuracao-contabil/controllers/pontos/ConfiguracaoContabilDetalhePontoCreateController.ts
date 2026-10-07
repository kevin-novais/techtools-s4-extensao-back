import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client-s4-dotz";
import { ConfiguracaoContabilDetalhePontoCreateService } from "@/modules/configuracao-contabil/services/pontos/ConfiguracaoContabilDetalhePontoCreateService";
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

const configuracaoContabilDetalhePontoCreateParamsSchema = z.object({
    configuracaoContabilId: z.coerce.number().int().positive(),
});

const configuracaoContabilDetalhePontoCreateSchema = z.object({
    ehPadrao: z.boolean().optional().default(false),
    codigoPonto: optionalString(20),
    descricaoPonto: optionalString(250),
    custoPonto: optionalDecimal(),
    contaCredito: optionalString(20),
    contaDebito: optionalString(20),
    centroCusto: optionalString(20),
    centroLucro: optionalString(20),
    contaCreditoReceitaExpiracao: optionalString(20),
    contaCreditoReceitaVendas: optionalString(20),
    contaCreditoReceitaResgate: optionalString(20),
    grupoPisCofins: grupoPisCofinsEnum,
    aliquotaPis: optionalDecimal(),
    aliquotaCofins: optionalDecimal(),
    contaCreditoPis: optionalString(20),
    contaDebitoPis: optionalString(20),
    contaCreditoCofins: optionalString(20),
    contaDebitoCofins: optionalString(20),
}).refine(
    (data) => {
        if (data.grupoPisCofins !== GrupoPisConfinsTypes.S) return true;
        return data.aliquotaPis != null && data.aliquotaCofins != null;
    },
    { message: "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios" },
);

export class ConfiguracaoContabilDetalhePontoCreateController {
    async handle(req: Request, res: Response) {
        const { configuracaoContabilId } = configuracaoContabilDetalhePontoCreateParamsSchema.parse(req.params);
        const body = configuracaoContabilDetalhePontoCreateSchema.parse(req.body);
        const usuarioId = req.user?.id!;

        const createService = new ConfiguracaoContabilDetalhePontoCreateService();
        const ponto = await createService.execute({
            configuracaoContabilId,
            data: body,
            usuarioId,
        });

        return res.status(201).json({
            message: "Ponto da configuração contábil criado com sucesso",
            ponto,
        });
    }
}
