import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatFluxoCaixaCiaTipoLancamento } from "@/modules/fluxo-caixa-xtpg/utils/formatFluxoCaixaXtpg";
import {
    normalizeDebitCreditKey,
    normalizeIsReversedKey,
    normalizeReversalReasonKey,
    normalizeXtpgCompanyCode,
} from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";

interface FluxoCaixaCiaTipoLancamentoKeyParams {
    companyCode: string;
    postingKey: string;
    documentType: string;
    referenceDocumentType: string;
    isReversed: string;
    reversalReason: string;
    debitCreditCode: string;
}

export class FluxoCaixaCiaTipoLancamentoShowService {
    async execute(raw: FluxoCaixaCiaTipoLancamentoKeyParams) {
        const key = this.normalizeKey(raw);

        const row = await s4DotzClient.fluxoCaixaCiaTipoLancamento.findUnique({
            where: {
                companyCode_postingKey_documentType_referenceDocumentType_isReversed_reversalReason_debitCreditCode:
                    key,
            },
        });

        if (!row) {
            throw new AppError("Parâmetro de tipo de lançamento não encontrado", 404);
        }

        return formatFluxoCaixaCiaTipoLancamento(row);
    }

    normalizeKey(raw: FluxoCaixaCiaTipoLancamentoKeyParams) {
        const companyCode = normalizeXtpgCompanyCode(raw.companyCode);
        const postingKey = raw.postingKey.trim().slice(0, 2);
        const documentType = raw.documentType.trim().slice(0, 2);
        const referenceDocumentType = raw.referenceDocumentType.trim().slice(0, 10);
        const isReversed = normalizeIsReversedKey(raw.isReversed);
        const reversalReason = normalizeReversalReasonKey(raw.reversalReason);
        const debitCreditCode = normalizeDebitCreditKey(raw.debitCreditCode).slice(0, 1);

        if (!postingKey) {
            throw new AppError("postingKey é obrigatório", 400);
        }

        if (!documentType) {
            throw new AppError("documentType é obrigatório", 400);
        }

        if (!debitCreditCode || (debitCreditCode !== "S" && debitCreditCode !== "H")) {
            throw new AppError("debitCreditCode deve ser S ou H", 400);
        }

        return {
            companyCode,
            postingKey,
            documentType,
            referenceDocumentType,
            isReversed,
            reversalReason,
            debitCreditCode,
        };
    }
}
