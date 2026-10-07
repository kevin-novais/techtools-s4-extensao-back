import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatConfiguracaoContabilDetalhe } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalhePayload {
    codigoItem?: string;
    grupoPisCofins: GrupoPisConfinsTypes;
    validarDivergencia?: boolean;
    aliquotaPis?: Prisma.Decimal;
    aliquotaCofins?: Prisma.Decimal;
    contaCreditoPis?: string;
    contaDebitoPis?: string;
    contaCreditoCofins?: string;
    contaDebitoCofins?: string;
    contaCreditoValorProduto?: string | null;
    contaDebitoValorProduto?: string | null;
    contaCreditoValorFrete?: string;
    contaDebitoValorFrete?: string;
    contaCreditoValorCombo?: string;
    contaDebitoValorCombo?: string;
    contaCreditoValorIs?: string;
    contaDebitoValorIs?: string;
    contaCreditoValorCbs?: string;
    contaDebitoValorCbs?: string;
    contaCreditoValorIbsUf?: string;
    contaDebitoValorIbsUf?: string;
    contaCreditoValorIbsMunicipal?: string;
    contaDebitoValorIbsMunicipal?: string;
    centroCusto?: string;
    centroLucro?: string;
}

interface ConfiguracaoContabilDetalheCreateServiceParams {
    configuracaoContabilId: number;
    data: ConfiguracaoContabilDetalhePayload;
    usuarioId: number;
}

export class ConfiguracaoContabilDetalheCreateService {
    async execute({ configuracaoContabilId, data, usuarioId }: ConfiguracaoContabilDetalheCreateServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        this.validateCreditoDebitoContas(data);
        this.validateAliquotasQuandoGrupoS(data);

        const detalheExistente = await s4DotzClient.configuracaoContabilDetalhe.findFirst({
            where: {
                configuracaoContabilId,
                grupoPisCofins: data.grupoPisCofins,
                codigoItem: data.codigoItem ?? null,
            },
        });

        if (detalheExistente) {
            throw new AppError(
                `Já existe um detalhe com o grupo PIS/COFINS '${data.grupoPisCofins}' e código de item '${data.codigoItem ?? "sem código"}' para esta configuração contábil`,
                409
            );
        }

        const now = new Date();

        const detalhe = await s4DotzClient.configuracaoContabilDetalhe.create({
            data: {
                configuracaoContabilId,
                codigoItem: data.codigoItem ?? null,
                grupoPisCofins: data.grupoPisCofins,
                validarDivergencia: data.validarDivergencia ?? true,
                aliquotaPis: data.aliquotaPis ?? null,
                aliquotaCofins: data.aliquotaCofins ?? null,
                contaCreditoPis: data.contaCreditoPis ?? null,
                contaDebitoPis: data.contaDebitoPis ?? null,
                contaCreditoCofins: data.contaCreditoCofins ?? null,
                contaDebitoCofins: data.contaDebitoCofins ?? null,
                contaCreditoValorProduto: data.contaCreditoValorProduto ?? null,
                contaDebitoValorProduto: data.contaDebitoValorProduto ?? null,
                contaCreditoValorFrete: data.contaCreditoValorFrete ?? null,
                contaDebitoValorFrete: data.contaDebitoValorFrete ?? null,
                contaCreditoValorCombo: data.contaCreditoValorCombo ?? null,
                contaDebitoValorCombo: data.contaDebitoValorCombo ?? null,
                contaCreditoValorIs: data.contaCreditoValorIs ?? null,
                contaDebitoValorIs: data.contaDebitoValorIs ?? null,
                contaCreditoValorCbs: data.contaCreditoValorCbs ?? null,
                contaDebitoValorCbs: data.contaDebitoValorCbs ?? null,
                contaCreditoValorIbsUf: data.contaCreditoValorIbsUf ?? null,
                contaDebitoValorIbsUf: data.contaDebitoValorIbsUf ?? null,
                contaCreditoValorIbsMunicipal: data.contaCreditoValorIbsMunicipal ?? null,
                contaDebitoValorIbsMunicipal: data.contaDebitoValorIbsMunicipal ?? null,
                centroCusto: data.centroCusto ?? null,
                centroLucro: data.centroLucro ?? null,
                criadoPor: usuarioId,
                criadoEm: now,
                atualizadoPor: usuarioId,
                atualizadoEm: now,
            },
        });

        return formatConfiguracaoContabilDetalhe(detalhe);
    }

    private validateCreditoDebitoContas(data: ConfiguracaoContabilDetalhePayload) {
        const pares = [
            { credito: data.contaCreditoValorProduto, debito: data.contaDebitoValorProduto, nome: "Produto" },
            { credito: data.contaCreditoValorFrete, debito: data.contaDebitoValorFrete, nome: "Frete" },
            { credito: data.contaCreditoValorCombo, debito: data.contaDebitoValorCombo, nome: "Combo" },
            { credito: data.contaCreditoPis, debito: data.contaDebitoPis, nome: "PIS" },
            { credito: data.contaCreditoCofins, debito: data.contaDebitoCofins, nome: "COFINS" },
            { credito: data.contaCreditoValorIs, debito: data.contaDebitoValorIs, nome: "IS" },
            { credito: data.contaCreditoValorCbs, debito: data.contaDebitoValorCbs, nome: "CBS" },
            { credito: data.contaCreditoValorIbsUf, debito: data.contaDebitoValorIbsUf, nome: "IBS UF" },
            { credito: data.contaCreditoValorIbsMunicipal, debito: data.contaDebitoValorIbsMunicipal, nome: "IBS Municipal" },
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

    private validateAliquotasQuandoGrupoS(data: ConfiguracaoContabilDetalhePayload) {
        if (data.grupoPisCofins !== GrupoPisConfinsTypes.S) return;

        if (data.aliquotaPis == null || data.aliquotaCofins == null) {
            throw new AppError(
                "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
                400
            );
        }
    }
}
