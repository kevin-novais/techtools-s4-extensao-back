import { Request, Response } from "express";
import { z } from "zod";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { assertVendasHeaderCiaAccess } from "@/modules/vendas/utils/assertVendasHeaderCiaAccess";
import { formatDateOnly, formatDateToBrazilianTimezone } from "@/util/date";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
    difeididaId: z.coerce.number().int().positive(),
});

export class VendaRecDiferidaShowController {
    handle = async (req: Request, res: Response) => {
        const ciaIds = req.user?.ciaIds || [];
        const { id: vendasHeaderId, difeididaId } = paramsSchema.parse(req.params);

        const parcela = await s4DotzClient.vendaRecDiferida.findUnique({
            where: { id: difeididaId },
        });

        if (!parcela || parcela.vendasHeaderId !== vendasHeaderId) {
            throw new AppError("Parcela diferida não encontrada", 404);
        }

        await assertVendasHeaderCiaAccess(vendasHeaderId, ciaIds);

        return res.status(200).json({
            id: parcela.id,
            vendasHeaderId: parcela.vendasHeaderId,
            periodoDiferimento: parcela.periodoDiferimento,
            tipo: parcela.tipo,
            status: parcela.status,
            ano: parcela.ano,
            dataEmissao: formatDateOnly(parcela.dataEmissao),
            dataDiferimento: formatDateOnly(parcela.dataDiferimento),
            valorDiferimento: parcela.valorDiferimento ? parcela.valorDiferimento.toString() : null,
            tipoContabilErp: parcela.tipoContabilErp,
            tipoDocumentoErp: parcela.tipoDocumentoErp,
            contaCredito: parcela.contaCredito,
            contaDebito: parcela.contaDebito,
            centroLucro: parcela.centroLucro,
            centroCusto: parcela.centroCusto,
            anoFiscalLancamento: parcela.anoFiscalLancamento,
            dataIntegracao: formatDateOnly(parcela.dataIntegracao),
            codigoDocumentoErp: parcela.codigoDocumentoErp,
            requestSap: parcela.requestSap,
            responseSap: parcela.responseSap,
            tipoContabilErpReversao: parcela.tipoContabilErpReversao,
            tipoDocumentoErpReversao: parcela.tipoDocumentoErpReversao,
            contaCreditoReversao: parcela.contaCreditoReversao,
            contaDebitoReversao: parcela.contaDebitoReversao,
            centroLucroReversao: parcela.centroLucroReversao,
            centroCustoReversao: parcela.centroCustoReversao,
            codigoDocumentoErpReversao: parcela.codigoDocumentoErpReversao,
            dataDoLancamentoDaReversao: formatDateOnly(parcela.dataDoLancamentoDaReversao),
            anoReversao: parcela.anoReversao,
            criadoEm: formatDateToBrazilianTimezone(parcela.criadoEm),
            atualizadoEm: formatDateToBrazilianTimezone(parcela.atualizadoEm),
        });
    };
}
