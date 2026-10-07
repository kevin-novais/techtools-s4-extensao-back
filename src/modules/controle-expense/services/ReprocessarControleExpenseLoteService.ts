import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { VexpensesApprovedReportsService } from "@/cron/modules/vexpenses/services/VexpensesApprovedReportsService";

const REPROCESSABLE_STATUSES = new Set(["PENDENTE", "ERRO_INTEGRACAO_SAP", "DESCARTADO"]);

export interface ReprocessarControleExpenseLoteParams {
  ids?: number[];
  status?: string;
}

export interface ReprocessarLoteResult {
  total: number;
  sucesso: number;
  ignorados: number;
  erros: Array<{ id: number; reportId: number; message: string }>;
}

export class ReprocessarControleExpenseLoteService {
  private readonly vexpensesService = new VexpensesApprovedReportsService();

  async execute(params: ReprocessarControleExpenseLoteParams): Promise<ReprocessarLoteResult> {
    const { ids, status } = params;
    if ((!ids || ids.length === 0) && !status) {
      throw new AppError("Informe ids ou status para o reprocessamento em lote", 400);
    }

    const where: Record<string, unknown> = {};
    if (ids && ids.length > 0) where.id = { in: ids };
    if (status) where.status = status;

    const registros: Array<{ id: number; reportId: number; status: string }> =
      await s4DotzClient.controleExpense.findMany({
        where,
        select: { id: true, reportId: true, status: true },
      });

    const elegiveis = registros.filter((r) => REPROCESSABLE_STATUSES.has(r.status));
    const erros: ReprocessarLoteResult["erros"] = [];
    let sucesso = 0;

    for (const r of elegiveis) {
      try {
        await this.vexpensesService.reprocessReport(r.reportId);
        sucesso += 1;
      } catch (e) {
        erros.push({ id: r.id, reportId: r.reportId, message: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      total: registros.length,
      sucesso,
      ignorados: registros.length - elegiveis.length,
      erros,
    };
  }
}
