import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { publishIntegrarVendas } from "@/queue/producers/vendasIntegrationProducer";
import log from "@/util/logger";

export const processVendasPendentesJob: CronJobDefinition = {
    name: "Process Vendas Pendentes",
    key: "process_vendas_pendentes",
    label: "Vendas — Processar vendas pendentes",
    manualTrigger: true,
    schedule: Config.CRON_PROCESS_VENDAS_PENDENTES,
    enabled: Config.CRON_PROCESS_VENDAS_PENDENTES_ENABLED,
    runOnInit: true,
    task: async () => {
        log.info("[ProcessVendasPendentes] Iniciando busca de vendas pendentes");

        const vendasPendentes = await s4DotzClient.vendasHeader.findMany({
            where: { status: StatusVendas.PENDENTE },
            select: { id: true },
            take: 50,
        });

        if (vendasPendentes.length === 0) {
            log.info("[ProcessVendasPendentes] Nenhuma venda pendente encontrada");
            return { totalReceived: 0, totalUpdated: 0 };
        }

        log.info(`[ProcessVendasPendentes] ${vendasPendentes.length} vendas pendentes encontradas`);

        let enqueued = 0;

        for (const venda of vendasPendentes) {
            try {
                // Atualizar status para PROCESSANDO antes de enfileirar
                await s4DotzClient.vendasHeader.update({
                    where: { id: venda.id },
                    data: {
                        status: StatusVendas.PROCESSANDO,
                        atualizadoEm: new Date(),
                    },
                });

                await publishIntegrarVendas({ vendasHeaderId: venda.id });
                enqueued++;
            } catch (error) {
                log.error(`[ProcessVendasPendentes] Erro ao enfileirar venda ${venda.id}: %o`, error);

                // Reverter status para PENDENTE em caso de erro
                try {
                    await s4DotzClient.vendasHeader.update({
                        where: { id: venda.id },
                        data: {
                            status: StatusVendas.PENDENTE,
                            atualizadoEm: new Date(),
                        },
                    });
                } catch (revertError) {
                    log.error(`[ProcessVendasPendentes] Erro ao reverter status da venda ${venda.id}: %o`, revertError);
                }
            }
        }

        log.info(`[ProcessVendasPendentes] ${enqueued} vendas enfileiradas para integração`);
        return { totalReceived: vendasPendentes.length, totalUpdated: enqueued };
    },
};
