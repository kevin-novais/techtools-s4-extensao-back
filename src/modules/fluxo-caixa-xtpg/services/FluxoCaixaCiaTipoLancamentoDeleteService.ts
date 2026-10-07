import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { FluxoCaixaCiaTipoLancamentoShowService } from "@/modules/fluxo-caixa-xtpg/services/FluxoCaixaCiaTipoLancamentoShowService";

interface FluxoCaixaCiaTipoLancamentoDeleteParams {
    companyCode: string;
    postingKey: string;
    documentType: string;
    referenceDocumentType: string;
    isReversed: string;
    reversalReason: string;
    debitCreditCode: string;
}

export class FluxoCaixaCiaTipoLancamentoDeleteService {
    private readonly keyNormalizer = new FluxoCaixaCiaTipoLancamentoShowService();

    async execute(raw: FluxoCaixaCiaTipoLancamentoDeleteParams) {
        const key = this.keyNormalizer.normalizeKey(raw);

        const existing = await s4DotzClient.fluxoCaixaCiaTipoLancamento.findUnique({
            where: {
                companyCode_postingKey_documentType_referenceDocumentType_isReversed_reversalReason_debitCreditCode:
                    key,
            },
        });

        if (!existing) {
            throw new AppError("Parâmetro de tipo de lançamento não encontrado", 404);
        }

        await s4DotzClient.fluxoCaixaCiaTipoLancamento.delete({
            where: {
                companyCode_postingKey_documentType_referenceDocumentType_isReversed_reversalReason_debitCreditCode:
                    key,
            },
        });

        return { message: "Parâmetro removido com sucesso" };
    }
}
