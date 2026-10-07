import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatConfiguracaoContabilDetalhePonto } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalhePontoPayload {
    ehPadrao?: boolean;
    codigoPonto?: string;
    descricaoPonto?: string;
    custoPonto?: Prisma.Decimal;
    contaCredito?: string;
    contaDebito?: string;
    centroCusto?: string;
    centroLucro?: string;
    contaCreditoReceitaExpiracao?: string;
    contaCreditoReceitaVendas?: string;
    contaCreditoReceitaResgate?: string;
    grupoPisCofins: GrupoPisConfinsTypes;
    aliquotaPis?: Prisma.Decimal;
    aliquotaCofins?: Prisma.Decimal;
    contaCreditoPis?: string;
    contaDebitoPis?: string;
    contaCreditoCofins?: string;
    contaDebitoCofins?: string;
}

interface ConfiguracaoContabilDetalhePontoCreateServiceParams {
    configuracaoContabilId: number;
    data: ConfiguracaoContabilDetalhePontoPayload;
    usuarioId: number;
}

export class ConfiguracaoContabilDetalhePontoCreateService {
    async execute({ configuracaoContabilId, data, usuarioId }: ConfiguracaoContabilDetalhePontoCreateServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        this.validateCreditoDebitoContas(data);
        this.validateAliquotasQuandoGrupoS(data);

        const pontoExistente = await s4DotzClient.configuracaoContabilDetalhePonto.findFirst({
            where: {
                configuracaoContabilId,
                grupoPisCofins: data.grupoPisCofins,
                codigoPonto: data.codigoPonto ?? null,
            },
        });

        if (pontoExistente) {
            throw new AppError(
                `Já existe um ponto com o grupo PIS/COFINS '${data.grupoPisCofins}' e código '${data.codigoPonto ?? "sem código"}' para esta configuração contábil`,
                409
            );
        }

        if (data.ehPadrao) {
            const padraoExistente = await s4DotzClient.configuracaoContabilDetalhePonto.findFirst({
                where: {
                    configuracaoContabilId,
                    ehPadrao: true,
                },
            });

            if (padraoExistente) {
                throw new AppError("Já existe um registro padrão para esta configuração contábil", 409);
            }
        }

        const now = new Date();

        const ponto = await s4DotzClient.configuracaoContabilDetalhePonto.create({
            data: {
                configuracaoContabilId,
                ehPadrao: data.ehPadrao ?? false,
                codigoPonto: data.codigoPonto ?? null,
                descricaoPonto: data.descricaoPonto ?? null,
                custoPonto: data.custoPonto ?? null,
                contaCredito: data.contaCredito ?? null,
                contaDebito: data.contaDebito ?? null,
                centroCusto: data.centroCusto ?? null,
                centroLucro: data.centroLucro ?? null,
                contaCreditoReceitaExpiracao: data.contaCreditoReceitaExpiracao ?? null,
                contaCreditoReceitaVendas: data.contaCreditoReceitaVendas ?? null,
                contaCreditoReceitaResgate: data.contaCreditoReceitaResgate ?? null,
                grupoPisCofins: data.grupoPisCofins,
                aliquotaPis: data.aliquotaPis ?? null,
                aliquotaCofins: data.aliquotaCofins ?? null,
                contaCreditoPis: data.contaCreditoPis ?? null,
                contaDebitoPis: data.contaDebitoPis ?? null,
                contaCreditoCofins: data.contaCreditoCofins ?? null,
                contaDebitoCofins: data.contaDebitoCofins ?? null,
                criadoPor: usuarioId,
                criadoEm: now,
                atualizadoPor: usuarioId,
                atualizadoEm: now,
            },
        });

        return formatConfiguracaoContabilDetalhePonto(ponto);
    }

    private validateCreditoDebitoContas(data: ConfiguracaoContabilDetalhePontoPayload) {
        const pares = [
            { credito: data.contaCredito, debito: data.contaDebito, nome: "Ponto" },
            { credito: data.contaCreditoPis, debito: data.contaDebitoPis, nome: "PIS" },
            { credito: data.contaCreditoCofins, debito: data.contaDebitoCofins, nome: "COFINS" },
        ];

        for (const par of pares) {
            if (par.credito && par.debito && par.credito === par.debito) {
                throw new AppError(
                    `Conta de crédito não pode ser igual à conta de débito para ${par.nome}`,
                    400
                );
            }
        }
    }

    private validateAliquotasQuandoGrupoS(data: ConfiguracaoContabilDetalhePontoPayload) {
        if (data.grupoPisCofins !== GrupoPisConfinsTypes.S) return;

        if (data.aliquotaPis == null || data.aliquotaCofins == null) {
            throw new AppError(
                "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
                400
            );
        }
    }
}
