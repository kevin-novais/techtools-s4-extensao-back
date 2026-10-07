import AppError from "@/util/AppError";
import { normalizeDateToMidnightUTC } from "@/util/date";

export function validateVendasDatas(
    dataEmissao: Date,
    dataLancamentoContabil: Date,
    dataVencimento?: Date,
): void {
    const dataAtual = normalizeDateToMidnightUTC(new Date());
    const dataEmissaoNormalizada = normalizeDateToMidnightUTC(dataEmissao);
    const dataLancamentoNormalizada = normalizeDateToMidnightUTC(dataLancamentoContabil);
    const dataVencimentoNormalizada = dataVencimento
        ? normalizeDateToMidnightUTC(dataVencimento)
        : null;

    if (dataEmissaoNormalizada > dataAtual) {
        throw new AppError("Venda com data de emissão futura", 400);
    }

    if (dataLancamentoNormalizada < dataEmissaoNormalizada) {
        throw new AppError("Data contábil menor que data de emissão da venda", 400);
    }

    if (
        dataVencimentoNormalizada &&
        dataVencimentoNormalizada < dataEmissaoNormalizada &&
        dataVencimentoNormalizada < dataLancamentoNormalizada
    ) {
        throw new AppError(
            "Data de vencimento menor que data de emissão e data contábil da venda",
            400,
        );
    }

    if (dataVencimentoNormalizada && dataVencimentoNormalizada < dataEmissaoNormalizada) {
        throw new AppError("Data de vencimento menor que data de emissão da venda", 400);
    }

    if (dataVencimentoNormalizada && dataVencimentoNormalizada < dataLancamentoNormalizada) {
        throw new AppError("Data de vencimento menor que data contábil da venda", 400);
    }
}
