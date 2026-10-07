import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { Prisma } from "@prisma/client-s4-dotz";
import { formatConfiguracaoContabilDetalhe } from "@/modules/configuracao-contabil/utils/formatConfiguracaoContabil";
import { GrupoPisConfinsTypes } from "@/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

interface ConfiguracaoContabilDetalheUpdatePayload {
    codigoItem?: string | null;
    grupoPisCofins?: GrupoPisConfinsTypes;
    validarDivergencia?: boolean;
    aliquotaPis?: Prisma.Decimal | null;
    aliquotaCofins?: Prisma.Decimal | null;
    contaCreditoPis?: string | null;
    contaDebitoPis?: string | null;
    contaCreditoCofins?: string | null;
    contaDebitoCofins?: string | null;
    contaCreditoValorProduto?: string | null;
    contaDebitoValorProduto?: string | null;
    contaCreditoValorFrete?: string | null;
    contaDebitoValorFrete?: string | null;
    contaCreditoValorCombo?: string | null;
    contaDebitoValorCombo?: string | null;
    contaCreditoValorIs?: string | null;
    contaDebitoValorIs?: string | null;
    contaCreditoValorCbs?: string | null;
    contaDebitoValorCbs?: string | null;
    contaCreditoValorIbsUf?: string | null;
    contaDebitoValorIbsUf?: string | null;
    contaCreditoValorIbsMunicipal?: string | null;
    contaDebitoValorIbsMunicipal?: string | null;
    centroCusto?: string | null;
    centroLucro?: string | null;
}

interface ConfiguracaoContabilDetalheUpdateServiceParams {
    configuracaoContabilId: number;
    detalheId: number;
    data: ConfiguracaoContabilDetalheUpdatePayload;
    usuarioId: number;
}

const hasValue = <T>(value: T | undefined): value is T =>
    value !== undefined;

export class ConfiguracaoContabilDetalheUpdateService {
    async execute({ configuracaoContabilId, detalheId, data, usuarioId }: ConfiguracaoContabilDetalheUpdateServiceParams) {
        const configuracaoExists = await s4DotzClient.configuracaoContabil.findUnique({
            where: { id: configuracaoContabilId },
        });

        if (!configuracaoExists) {
            throw new AppError("Configuração contábil não encontrada", 404);
        }

        const detalhe = await s4DotzClient.configuracaoContabilDetalhe.findUnique({
            where: { id: detalheId },
        });

        if (!detalhe) {
            throw new AppError("Detalhe da configuração contábil não encontrado", 404);
        }

        if (detalhe.configuracaoContabilId !== configuracaoContabilId) {
            throw new AppError("Detalhe não pertence à configuração informada", 400);
        }

        this.validateCreditoDebitoContas(data, detalhe);
        this.validateAliquotasQuandoGrupoS(data, detalhe);

        const updateData = {
            ...this.buildUpdateData(data),
            atualizadoPor: usuarioId,
            atualizadoEm: new Date(),
        };

        const detalheAtualizado = await s4DotzClient.configuracaoContabilDetalhe.update({
            where: { id: detalheId },
            data: updateData,
        });

        return formatConfiguracaoContabilDetalhe(detalheAtualizado);
    }

    private buildUpdateData(data: ConfiguracaoContabilDetalheUpdatePayload): Record<string, unknown> {
        const updateData: Record<string, unknown> = {};

        const fields: (keyof ConfiguracaoContabilDetalheUpdatePayload)[] = [
            "codigoItem", "grupoPisCofins", "validarDivergencia",
            "aliquotaPis", "aliquotaCofins",
            "contaCreditoPis", "contaDebitoPis",
            "contaCreditoCofins", "contaDebitoCofins",
            "contaCreditoValorProduto", "contaDebitoValorProduto",
            "contaCreditoValorFrete", "contaDebitoValorFrete",
            "contaCreditoValorCombo", "contaDebitoValorCombo",
            "contaCreditoValorIs", "contaDebitoValorIs",
            "contaCreditoValorCbs", "contaDebitoValorCbs",
            "contaCreditoValorIbsUf", "contaDebitoValorIbsUf",
            "contaCreditoValorIbsMunicipal", "contaDebitoValorIbsMunicipal",
            "centroCusto", "centroLucro",
        ];

        for (const field of fields) {
            if (hasValue(data[field])) {
                updateData[field] = data[field] ?? null;
            }
        }

        return updateData;
    }

    private validateCreditoDebitoContas(
        data: ConfiguracaoContabilDetalheUpdatePayload,
        detalheAtual: any
    ) {
        // Mescla valores atuais com os novos para validação
        const getMergedValue = (novoValor: any, valorAtual: any) =>
            hasValue(novoValor) ? (novoValor ?? null) : valorAtual;

        const pares = [
            {
                credito: getMergedValue(data.contaCreditoValorProduto, detalheAtual.contaCreditoValorProduto),
                debito: getMergedValue(data.contaDebitoValorProduto, detalheAtual.contaDebitoValorProduto),
                nome: "Produto",
            },
            {
                credito: getMergedValue(data.contaCreditoValorFrete, detalheAtual.contaCreditoValorFrete),
                debito: getMergedValue(data.contaDebitoValorFrete, detalheAtual.contaDebitoValorFrete),
                nome: "Frete",
            },
            {
                credito: getMergedValue(data.contaCreditoValorCombo, detalheAtual.contaCreditoValorCombo),
                debito: getMergedValue(data.contaDebitoValorCombo, detalheAtual.contaDebitoValorCombo),
                nome: "Combo",
            },
            {
                credito: getMergedValue(data.contaCreditoPis, detalheAtual.contaCreditoPis),
                debito: getMergedValue(data.contaDebitoPis, detalheAtual.contaDebitoPis),
                nome: "PIS",
            },
            {
                credito: getMergedValue(data.contaCreditoCofins, detalheAtual.contaCreditoCofins),
                debito: getMergedValue(data.contaDebitoCofins, detalheAtual.contaDebitoCofins),
                nome: "COFINS",
            },
            {
                credito: getMergedValue(data.contaCreditoValorIs, detalheAtual.contaCreditoValorIs),
                debito: getMergedValue(data.contaDebitoValorIs, detalheAtual.contaDebitoValorIs),
                nome: "IS",
            },
            {
                credito: getMergedValue(data.contaCreditoValorCbs, detalheAtual.contaCreditoValorCbs),
                debito: getMergedValue(data.contaDebitoValorCbs, detalheAtual.contaDebitoValorCbs),
                nome: "CBS",
            },
            {
                credito: getMergedValue(data.contaCreditoValorIbsUf, detalheAtual.contaCreditoValorIbsUf),
                debito: getMergedValue(data.contaDebitoValorIbsUf, detalheAtual.contaDebitoValorIbsUf),
                nome: "IBS UF",
            },
            {
                credito: getMergedValue(data.contaCreditoValorIbsMunicipal, detalheAtual.contaCreditoValorIbsMunicipal),
                debito: getMergedValue(data.contaDebitoValorIbsMunicipal, detalheAtual.contaDebitoValorIbsMunicipal),
                nome: "IBS Municipal",
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
        data: ConfiguracaoContabilDetalheUpdatePayload,
        detalheAtual: { grupoPisCofins: string; aliquotaPis: unknown; aliquotaCofins: unknown }
    ) {
        const grupoPisCofinsFinal = hasValue(data.grupoPisCofins) ? data.grupoPisCofins : detalheAtual.grupoPisCofins;
        if (grupoPisCofinsFinal !== GrupoPisConfinsTypes.S) return;

        const aliquotaPisFinal = hasValue(data.aliquotaPis) ? data.aliquotaPis ?? null : detalheAtual.aliquotaPis;
        const aliquotaCofinsFinal = hasValue(data.aliquotaCofins) ? data.aliquotaCofins ?? null : detalheAtual.aliquotaCofins;

        if (aliquotaPisFinal == null || aliquotaCofinsFinal == null) {
            throw new AppError(
                "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
                400
            );
        }
    }
}
