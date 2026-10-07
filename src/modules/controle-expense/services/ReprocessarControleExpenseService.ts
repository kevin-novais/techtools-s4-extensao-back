import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

const REPROCESSABLE_STATUSES = new Set([
    "PENDENTE",
    "ERRO_INTEGRACAO_SAP",
    "DESCARTADO",
]);

interface ReprocessarControleExpenseParams {
    id: number;
}

export class ReprocessarControleExpenseService {
    private readonly vexpensesService = new VexpensesApprovedReportsService();

    async execute({ id }: ReprocessarControleExpenseParams): Promise<{ reportId: number }> {
        const controle = await s4DotzClient.controleExpense.findUnique({
            where: { id },
            select: { id: true, reportId: true, status: true },
        });

        if (!controle) {
            throw new AppError("Controle de despesa não encontrado", 404);
        }

        if (!REPROCESSABLE_STATUSES.has(controle.status)) {
            throw new AppError(
                `Relatório no status ${controle.status} não pode ser reprocessado`,
                409,
            );
        }

        await this.vexpensesService.reprocessReport(controle.reportId);

        return { reportId: controle.reportId };
    }
}
