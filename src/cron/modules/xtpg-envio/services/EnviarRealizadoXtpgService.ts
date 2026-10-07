/**
 * Envio XTPG - Fluxo REALIZADO (SendFlux).
 * Lê a view XRT_SendFlux e envia os movimentos em lote, registrando os logs
 * nas tabelas xtpg_envio_realizado_header / _detail.
 */
import { createEnviarXtpgService } from "@/cron/modules/xtpg-envio/services/xtpgEnvioFactory";
import type { ResumoEnvioXtpg } from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

export class EnviarRealizadoXtpgService {
    async execute(): Promise<ResumoEnvioXtpg> {
        return createEnviarXtpgService("REALIZADO").execute();
    }
}
