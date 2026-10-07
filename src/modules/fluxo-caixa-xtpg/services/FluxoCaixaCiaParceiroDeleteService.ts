import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

interface FluxoCaixaCiaParceiroDeleteParams {
    cardCode: string;
    companyCode: string;
}

export class FluxoCaixaCiaParceiroDeleteService {
    async execute(params: FluxoCaixaCiaParceiroDeleteParams) {
        const cardCode = params.cardCode.trim();
        const companyCode = normalizeXtpgCompanyCode(params.companyCode);

        if (!cardCode) {
            throw new AppError("cardCode é obrigatório", 400);
        }

        const existing = await s4DotzClient.fluxoCaixaCiaParceiro.findUnique({
            where: {
                cardCode_companyCode: { cardCode, companyCode },
            },
        });

        if (!existing) {
            throw new AppError("Vínculo não encontrado", 404);
        }

        await s4DotzClient.fluxoCaixaCiaParceiro.delete({
            where: {
                cardCode_companyCode: { cardCode, companyCode },
            },
        });

        return { message: "Vínculo removido com sucesso" };
    }
}
