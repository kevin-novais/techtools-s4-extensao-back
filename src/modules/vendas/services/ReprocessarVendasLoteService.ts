import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { publishIntegrarVendas } from "@/queue/producers/vendasIntegrationProducer";

const STATUSES_REPROCESSAVEIS = new Set<string>([
  StatusVendas.PENDENTE,
  StatusVendas.PROCESSANDO,
  StatusVendas.ERRO_PROC,
  StatusVendas.ERRO_INTEG_SAP,
]);

export interface ReprocessarVendasLoteParams {
  ciaIds: number[];
  ids?: number[];
  status?: string;
}

export interface ReprocessarVendasLoteResult {
  total: number;
  sucesso: number;
  ignorados: number;
  erros: Array<{ id: number; message: string }>;
}

export class ReprocessarVendasLoteService {
  async execute(params: ReprocessarVendasLoteParams): Promise<ReprocessarVendasLoteResult> {
    const { ciaIds, ids, status } = params;

    if (ciaIds.length === 0) {
      throw new AppError("Você não tem acesso a nenhuma CIA", 403);
    }
    if ((!ids || ids.length === 0) && !status) {
      throw new AppError("Informe ids ou status para o reprocessamento em lote", 400);
    }

    const cias: Array<{ ciaIdSAP: string | null }> = await s4DotzClient.cia.findMany({
      where: { id: { in: ciaIds }, deletadoEm: null },
      select: { ciaIdSAP: true },
    });
    const allowedSaps = cias
      .map((c) => c.ciaIdSAP)
      .filter((s): s is string => Boolean(s));

    if (allowedSaps.length === 0) {
      return { total: 0, sucesso: 0, ignorados: 0, erros: [] };
    }

    const where: Record<string, unknown> = { ciaIdSAP: { in: allowedSaps } };
    if (ids && ids.length > 0) where.id = { in: ids };
    if (status) where.status = status;

    const registros: Array<{ id: number; status: string }> =
      await s4DotzClient.vendasHeader.findMany({
        where,
        select: { id: true, status: true },
      });

    const elegiveis = registros.filter((r) => STATUSES_REPROCESSAVEIS.has(r.status));
    const erros: ReprocessarVendasLoteResult["erros"] = [];
    let sucesso = 0;

    for (const r of elegiveis) {
      const previousStatus = r.status;
      try {
        await s4DotzClient.vendasHeader.update({
          where: { id: r.id },
          data: { status: StatusVendas.PROCESSANDO, atualizadoEm: new Date() },
        });
        await publishIntegrarVendas({ vendasHeaderId: r.id });
        sucesso += 1;
      } catch (e) {
        try {
          await s4DotzClient.vendasHeader.update({
            where: { id: r.id },
            data: { status: previousStatus, atualizadoEm: new Date() },
          });
        } catch {
          // ignora falha ao reverter; o erro principal já será reportado
        }
        erros.push({ id: r.id, message: e instanceof Error ? e.message : String(e) });
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
