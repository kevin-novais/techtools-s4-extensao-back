import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export interface RegistrosContabeisUpdateItemFluxoParams {
    companyCode: string;
    fiscalYear: string;
    accountingDocument: string;
    accountingDocumentItem: string;
    itemFluxoDeCaixa: string;
}

/**
 * (DTZ-248) Atualiza a coluna Item Fluxo de Caixa de um registro contábil e zera
 * `status_para_envio` para que o registro volte a ser enviado ao XTPG (as views
 * XRT_SendPrev/SendFlux só selecionam status NULL). Não altera o Journal Entry do B1.
 */
export class RegistrosContabeisUpdateItemFluxoService {
    async execute(params: RegistrosContabeisUpdateItemFluxoParams): Promise<void> {
        const {
            companyCode,
            fiscalYear,
            accountingDocument,
            accountingDocumentItem,
            itemFluxoDeCaixa,
        } = params;

        const itemValido = await s4DotzClient.itemFluxoCaixa.findUnique({
            where: { codigo: itemFluxoDeCaixa },
        });
        if (!itemValido) {
            throw new AppError(
                `Item de fluxo de caixa inválido: ${itemFluxoDeCaixa}`,
                400,
            );
        }

        const result = await s4DotzClient.accountingDocumentItem.updateMany({
            where: {
                CompanyCode: companyCode,
                FiscalYear: fiscalYear,
                AccountingDocument: accountingDocument,
                AccountingDocumentItem: accountingDocumentItem,
            },
            data: {
                ItemFluxodeCaixa: itemFluxoDeCaixa,
                StatusParaEnvio: null,
            },
        });

        if (!result.count) {
            throw new AppError("Registro contábil não encontrado", 404);
        }
    }
}
