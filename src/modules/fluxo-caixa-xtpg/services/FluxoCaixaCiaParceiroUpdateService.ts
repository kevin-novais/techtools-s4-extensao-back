import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatFluxoCaixaCiaParceiro } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

interface FluxoCaixaCiaParceiroUpdateParams {
    cardCode: string;
    companyCode: string;
    itemFluxoCaixa: string;
    usuarioId: number;
}

export class FluxoCaixaCiaParceiroUpdateService {
    async execute(params: FluxoCaixaCiaParceiroUpdateParams) {
        const cardCode = params.cardCode.trim();
        const companyCode = normalizeXtpgCompanyCode(params.companyCode);
        const itemFluxoCaixa = params.itemFluxoCaixa.trim();
        const { usuarioId } = params;

        if (!cardCode) {
            throw new AppError("cardCode é obrigatório", 400);
        }

        if (!itemFluxoCaixa) {
            throw new AppError("itemFluxoCaixa é obrigatório", 400);
        }

        if (itemFluxoCaixa.length > 20) {
            throw new AppError("itemFluxoCaixa deve ter no máximo 20 caracteres", 400);
        }

        const existing = await s4DotzClient.fluxoCaixaCiaParceiro.findUnique({
            where: {
                cardCode_companyCode: { cardCode, companyCode },
            },
        });

        if (!existing) {
            throw new AppError("Vínculo não encontrado", 404);
        }

        const row = await s4DotzClient.fluxoCaixaCiaParceiro.update({
            where: {
                cardCode_companyCode: { cardCode, companyCode },
            },
            data: {
                itemFluxoCaixa,
                atualizadoPor: usuarioId,
            },
        });

        return formatFluxoCaixaCiaParceiro(row);
    }
}
