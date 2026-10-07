import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { publishReverterDiferida } from "@/queue/producers/vendaRecDiferidaProducer";
import log from "@/util/logger";

const BATCH_SIZE = 50;

export const processVendaRecDiferidaReversaoJob: CronJobDefinition = {
    name: "Process VendaRecDiferida Reversao",
    key: "process_venda_rec_diferida_reversao",
    label: "Vendas — Reversão de receitas diferidas",
    manualTrigger: true,
    schedule: Config.CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO,
    enabled: Config.CRON_PROCESS_VENDA_REC_DIFERIDA_REVERSAO_ENABLED,
    task: async () => {
        log.info("[ProcessVendaRecDiferidaReversao] Buscando parcelas com reversão pendente");

        const parcelas = await s4DotzClient.vendaRecDiferida.findMany({
            where: { status: StatusVendaRecDiferida.REVERSAO_PENDENTE },
            select: { id: true },
            take: BATCH_SIZE,
        });

        if (parcelas.length === 0) {
            log.info("[ProcessVendaRecDiferidaReversao] Nenhuma parcela com reversão pendente encontrada");
            return { totalReceived: 0, totalUpdated: 0 };
        }

        log.info(
            `[ProcessVendaRecDiferidaReversao] ${parcelas.length} parcelas encontradas para reversão`,
        );

        let enqueued = 0;

        for (const parcela of parcelas) {
            try {
                await publishReverterDiferida({ vendaRecDiferidaId: parcela.id });
                enqueued++;
            } catch (error) {
                log.error(
                    `[ProcessVendaRecDiferidaReversao] Erro ao enfileirar parcela ${parcela.id}: %o`,
                    error,
                );
            }
        }

        log.info(
            `[ProcessVendaRecDiferidaReversao] ${enqueued} parcelas enfileiradas para reversão`,
        );
        return { totalReceived: parcelas.length, totalUpdated: enqueued };
    },
};
