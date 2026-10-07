import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatFluxoCaixaCiaTipoLancamento } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import { FluxoCaixaCiaTipoLancamentoShowService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoShowService";

interface FluxoCaixaCiaTipoLancamentoUpdateParams {
    companyCode: string;
    postingKey: string;
    documentType: string;
    referenceDocumentType: string;
    isReversed: string;
    reversalReason: string;
    debitCreditCode: string;
    itemFluxoCaixa: string;
    usuarioId: number;
}

export class FluxoCaixaCiaTipoLancamentoUpdateService {
    private readonly keyNormalizer = new FluxoCaixaCiaTipoLancamentoShowService();

    async execute(params: FluxoCaixaCiaTipoLancamentoUpdateParams) {
        const key = this.keyNormalizer.normalizeKey({
            companyCode: params.companyCode,
            postingKey: params.postingKey,
            documentType: params.documentType,
            referenceDocumentType: params.referenceDocumentType,
            isReversed: params.isReversed,
            reversalReason: params.reversalReason,
            debitCreditCode: params.debitCreditCode,
        });

        const itemFluxoCaixa = params.itemFluxoCaixa.trim();

        if (!itemFluxoCaixa) {
            throw new AppError("itemFluxoCaixa é obrigatório", 400);
        }

        if (itemFluxoCaixa.length > 20) {
            throw new AppError("itemFluxoCaixa deve ter no máximo 20 caracteres", 400);
        }

        const existing = await s4DotzClient.fluxoCaixaCiaTipoLancamento.findUnique({
            where: {
                companyCode_postingKey_documentType_referenceDocumentType_isReversed_reversalReason_debitCreditCode:
                    key,
            },
        });

        if (!existing) {
            throw new AppError("Parâmetro de tipo de lançamento não encontrado", 404);
        }

        const row = await s4DotzClient.fluxoCaixaCiaTipoLancamento.update({
            where: {
                companyCode_postingKey_documentType_referenceDocumentType_isReversed_reversalReason_debitCreditCode:
                    key,
            },
            data: {
                itemFluxoCaixa,
                atualizadoPor: params.usuarioId,
            },
        });

        return formatFluxoCaixaCiaTipoLancamento(row);
    }
}
