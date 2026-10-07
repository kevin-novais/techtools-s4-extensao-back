import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatFluxoCaixaCiaParceiro } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

interface FluxoCaixaCiaParceiroShowParams {
    cardCode: string;
    companyCode: string;
}

export class FluxoCaixaCiaParceiroShowService {
    async execute(params: FluxoCaixaCiaParceiroShowParams) {
        const cardCode = params.cardCode.trim();
        const companyCode = normalizeXtpgCompanyCode(params.companyCode);

        if (!cardCode) {
            throw new AppError("cardCode é obrigatório", 400);
        }

        const row = await s4DotzClient.fluxoCaixaCiaParceiro.findUnique({
            where: {
                cardCode_companyCode: {
                    cardCode,
                    companyCode,
                },
            },
        });

        if (!row) {
            throw new AppError("Vínculo não encontrado", 404);
        }

        return formatFluxoCaixaCiaParceiro(row);
    }
}
