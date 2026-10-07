/** Detalhe de um lote (HEADER + DETALHEs) com o status atual do registro e flag de reprocessável. */
import AppError from "@/util/AppError";
import { getLogDelegates, loadRegistroStatusByChaves } from "@/modules/xtpg-envio/utils/registroStatus";
import { XTPG_DETAIL_STATUS, buildStatusParaEnvio, type XtpgFluxo } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

export class XtpgEnvioHeaderShowService {
    async execute(params: { fluxo: XtpgFluxo; id: number }) {
        const { fluxo, id } = params;
        const { header } = getLogDelegates(fluxo);

        const found = await header.findUnique({ where: { id }, include: { detalhes: true } });
        if (!found) {
            throw new AppError("Lote de envio XTPG não encontrado.", 404);
        }

        const statusMap = await loadRegistroStatusByChaves(
            found.detalhes.map((d: { origemDocEntry: string | null }) => d.origemDocEntry),
        );

        const detalhes = found.detalhes.map((d: Record<string, unknown>) => {
            const chave = d.origemDocEntry as string | null;
            const registroStatus = chave ? statusMap.get(chave) ?? null : null;
            const reprocessavel =
                d.status === XTPG_DETAIL_STATUS.ERRO ||
                registroStatus === buildStatusParaEnvio(fluxo, "PROCESSANDO");
            return { ...d, registroStatus, reprocessavel };
        });

        return { fluxo, header: { ...found, detalhes } };
    }
}
