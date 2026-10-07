import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatConfiguracaoContabilDetalhePonto } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalhePontoUpdatePayload {
    ehPadrao?: boolean;
    codigoPonto?: string | null;
    descricaoPonto?: string | null;
    custoPonto?: Prisma.Decimal | null;
    contaCredito?: string | null;
    contaDebito?: string | null;
    centroCusto?: string | null;
    centroLucro?: string | null;
    contaCreditoReceitaExpiracao?: string | null;
    contaCreditoReceitaVendas?: string | null;
    contaCreditoReceitaResgate?: string | null;
    grupoPisCofins?: GrupoPisConfinsTypes;
    aliquotaPis?: Prisma.Decimal | null;
    aliquotaCofins?: Prisma.Decimal | null;
    contaCreditoPis?: string | null;
    contaDebitoPis?: string | null;
    contaCreditoCofins?: string | null;
    contaDebitoCofins?: string | null;
}

interface ConfiguracaoContabilDetalhePontoUpdateServiceParams {
    configuracaoContabilId: number;
    pontoId: number;
    data: ConfiguracaoContabilDetalhePontoUpdatePayload;
    usuarioId: number;
}

const hasValue = <T>(value: T | undefined): value is T =>
    value !== undefined;

export class ConfiguracaoContabilDetalhePontoUpdateService {
    async execute({ configuracaoContabilId, pontoId, data, usuarioId }: ConfiguracaoContabilDetalhePontoUpdateServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const ponto = await s4DotzClient.configuracaoContabilDetalhePonto.findUnique({
            where: { id: pontoId },
        });

        if (!ponto) {
            throw new AppError("Ponto da configuração contábil não encontrado", 404);
        }

        if (ponto.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Ponto não pertence à configuração informada", 400);
        }

        await this.validateUniqueKey(data, ponto, configuracaoContabilId, pontoId);

        if (data.ehPadrao === true) {
            const padraoExistente = await s4DotzClient.configuracaoContabilDetalhePonto.findFirst({
                where: {
                    configuracaoContabilId,
                    ehPadrao: true,
                    id: { not: pontoId },
                },
            });

            if (padraoExistente) {
                throw new AppError("Já existe um registro padrão para esta configuração contábil", 409);
            }
        }

        this.validateCreditoDebitoContas(data, ponto);
        this.validateAliquotasQuandoGrupoS(data, ponto);

        const pontoAtualizado = await s4DotzClient.configuracaoContabilDetalhePonto.update({
            where: { id: pontoId },
            data: {
                ...this.buildUpdateData(data),
                atualizadoPor: usuarioId,
                atualizadoEm: new Date(),
            },
        });

        return formatConfiguracaoContabilDetalhePonto(pontoAtualizado);
    }

    private async validateUniqueKey(
        data: ConfiguracaoContabilDetalhePontoUpdatePayload,
        pontoAtual: { grupoPisCofins: string; codigoPonto: string | null },
        configuracaoContabilId: number,
        pontoId: number
    ) {
        const grupoPisCofinsFinal = hasValue(data.grupoPisCofins) ? data.grupoPisCofins : pontoAtual.grupoPisCofins;
        const codigoPontoFinal = hasValue(data.codigoPonto) ? (data.codigoPonto ?? null) : pontoAtual.codigoPonto;

        const grupoAlterado = hasValue(data.grupoPisCofins) && data.grupoPisCofins !== pontoAtual.grupoPisCofins;
        const codigoAlterado = hasValue(data.codigoPonto) && (data.codigoPonto ?? null) !== pontoAtual.codigoPonto;

        if (!grupoAlterado && !codigoAlterado) return;

        const duplicado = await s4DotzClient.configuracaoContabilDetalhePonto.findFirst({
            where: {
                configuracaoContabilId,
                grupoPisCofins: grupoPisCofinsFinal,
                codigoPonto: codigoPontoFinal,
                id: { not: pontoId },
            },
        });

        if (duplicado) {
            throw new AppError(
                `Já existe um ponto com o grupo PIS/COFINS '${grupoPisCofinsFinal}' e código '${codigoPontoFinal ?? "sem código"}' para esta configuração contábil`,
                409
            );
        }
    }

    private buildUpdateData(data: ConfiguracaoContabilDetalhePontoUpdatePayload): Record<string, unknown> {
        const updateData: Record<string, unknown> = {};

        const fields: (keyof ConfiguracaoContabilDetalhePontoUpdatePayload)[] = [
            "ehPadrao",
            "codigoPonto",
            "descricaoPonto",
            "custoPonto",
            "contaCredito",
            "contaDebito",
            "centroCusto",
            "centroLucro",
            "contaCreditoReceitaExpiracao",
            "contaCreditoReceitaVendas",
            "contaCreditoReceitaResgate",
            "grupoPisCofins",
            "aliquotaPis",
            "aliquotaCofins",
            "contaCreditoPis",
            "contaDebitoPis",
            "contaCreditoCofins",
            "contaDebitoCofins",
        ];

        for (const field of fields) {
            if (hasValue(data[field])) {
                updateData[field] = data[field] ?? null;
            }
        }

        return updateData;
    }

    private validateCreditoDebitoContas(
        data: ConfiguracaoContabilDetalhePontoUpdatePayload,
        pontoAtual: {
            contaCredito: string | null;
            contaDebito: string | null;
            contaCreditoPis: string | null;
            contaDebitoPis: string | null;
            contaCreditoCofins: string | null;
            contaDebitoCofins: string | null;
        }
    ) {
        const getMergedValue = (novoValor: string | null | undefined, valorAtual: string | null) =>
            hasValue(novoValor) ? (novoValor ?? null) : valorAtual;

        const pares = [
            {
                credito: getMergedValue(data.contaCredito, pontoAtual.contaCredito),
                debito: getMergedValue(data.contaDebito, pontoAtual.contaDebito),
                nome: "Ponto",
            },
            {
                credito: getMergedValue(data.contaCreditoPis, pontoAtual.contaCreditoPis),
                debito: getMergedValue(data.contaDebitoPis, pontoAtual.contaDebitoPis),
                nome: "PIS",
            },
            {
                credito: getMergedValue(data.contaCreditoCofins, pontoAtual.contaCreditoCofins),
                debito: getMergedValue(data.contaDebitoCofins, pontoAtual.contaDebitoCofins),
                nome: "COFINS",
            },
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

    private validateAliquotasQuandoGrupoS(
        data: ConfiguracaoContabilDetalhePontoUpdatePayload,
        pontoAtual: { grupoPisCofins: string; aliquotaPis: unknown; aliquotaCofins: unknown }
    ) {
        const grupoPisCofinsFinal = hasValue(data.grupoPisCofins) ? data.grupoPisCofins : pontoAtual.grupoPisCofins;
        if (grupoPisCofinsFinal !== GrupoPisConfinsTypes.S) return;

        const aliquotaPisFinal = hasValue(data.aliquotaPis) ? data.aliquotaPis ?? null : pontoAtual.aliquotaPis;
        const aliquotaCofinsFinal = hasValue(data.aliquotaCofins) ? data.aliquotaCofins ?? null : pontoAtual.aliquotaCofins;

        if (aliquotaPisFinal == null || aliquotaCofinsFinal == null) {
            throw new AppError(
                "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
                400
            );
        }
    }
}
