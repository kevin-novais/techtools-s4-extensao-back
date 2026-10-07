/**
 * Envio XTPG - Fluxo PREVISTO (SendPrev).
 * Lê a view XRT_SendPrevPagto e envia os movimentos em lote, registrando os logs
 * nas tabelas xtpg_envio_previsto_header / _detail.
 */
import { createEnviarXtpgService } from "@/cron/modules/xtpg-envio/services/xtpgEnvioFactory";
import type { ResumoEnvioXtpg } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

export class EnviarPrevistoXtpgService {
    async execute(): Promise<ResumoEnvioXtpg> {
        return createEnviarXtpgService("PREVISTO").execute();
    }
}
