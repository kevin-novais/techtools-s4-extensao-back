import s4DotzClient from "@/database/clients/s4DotzClient";
import dotzStageClient from "@/database/clients/dotzStageClient";
import AppError from "@/util/AppError";
import { formatFluxoCaixaCiaParceiro } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

interface FluxoCaixaCiaParceiroCreateParams {
    cardCode: string;
    companyCode: string;
    itemFluxoCaixa: string;
    usuarioId: number;
    validateOcrExists?: boolean;
}

export class FluxoCaixaCiaParceiroCreateService {
    async execute(params: FluxoCaixaCiaParceiroCreateParams) {
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

        if (params.validateOcrExists !== false) {
            const ocr = await dotzStageClient().oCRD.findFirst({
                where: { CardCode: cardCode, ativo: true },
                select: { CardCode: true },
            });

            if (!ocr) {
                throw new AppError("Fornecedor (OCRD) não encontrado ou inativo", 404);
            }
        }

        const exists = await s4DotzClient.fluxoCaixaCiaParceiro.findUnique({
            where: {
                cardCode_companyCode: { cardCode, companyCode },
            },
        });

        if (exists) {
            throw new AppError("Vínculo já existe para este parceiro e código de empresa", 409);
        }

        const row = await s4DotzClient.fluxoCaixaCiaParceiro.create({
            data: {
                cardCode,
                companyCode,
                itemFluxoCaixa,
                criadoPor: usuarioId,
                atualizadoPor: usuarioId,
            },
        });

        return formatFluxoCaixaCiaParceiro(row);
    }
}
