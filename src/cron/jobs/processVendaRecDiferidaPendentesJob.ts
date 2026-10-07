import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusVendaRecDiferida } from "@/@types/VendaRecDiferida/StatusVendaRecDiferidaTypes";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { publishIntegrarDiferida } from "@/queue/producers/vendaRecDiferidaProducer";
import log from "@/util/logger";

const BATCH_SIZE = 50;

export const processVendaRecDiferidaPendentesJob: CronJobDefinition = {
    name: "Process VendaRecDiferida Pendentes",
    key: "process_venda_rec_diferida_pendentes",
    label: "Vendas — Receitas diferidas pendentes",
    manualTrigger: true,
    schedule: Config.CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES,
    enabled: Config.CRON_PROCESS_VENDA_REC_DIFERIDA_PENDENTES_ENABLED,
    runOnInit : true,
    task: async () => {
        log.info("[ProcessVendaRecDiferidaPendentes] Buscando parcelas diferidas pendentes elegíveis");

        const hoje = new Date();
        hoje.setUTCHours(23, 59, 59, 999);

        // (DTZ-278) Barra o lançamento de novas parcelas de vendas canceladas: parcelas
        // cujo cabeçalho está CANCELADO não são mais integradas (a venda foi revertida no SAP).
        const parcelas = await s4DotzClient.vendaRecDiferida.findMany({
            where: {
                status: StatusVendaRecDiferida.PENDENTE,
                dataDiferimento: { lte: hoje },
                vendasHeader: { status: { not: StatusVendas.CANCELADO } },
            },
            select: { id: true },
            take: BATCH_SIZE,
        });

        if (parcelas.length === 0) {
            log.info("[ProcessVendaRecDiferidaPendentes] Nenhuma parcela pendente elegível encontrada");
            return { totalReceived: 0, totalUpdated: 0 };
        }

        log.info(
            `[ProcessVendaRecDiferidaPendentes] ${parcelas.length} parcelas elegíveis encontradas`,
        );

        let enqueued = 0;

        for (const parcela of parcelas) {
            try {
                await publishIntegrarDiferida({ vendaRecDiferidaId: parcela.id });
                enqueued++;
            } catch (error) {
                log.error(
                    `[ProcessVendaRecDiferidaPendentes] Erro ao enfileirar parcela ${parcela.id}: %o`,
                    error,
                );
            }
        }

        log.info(
            `[ProcessVendaRecDiferidaPendentes] ${enqueued} parcelas enfileiradas para integração`,
        );
        return { totalReceived: parcelas.length, totalUpdated: enqueued };
    },
};
