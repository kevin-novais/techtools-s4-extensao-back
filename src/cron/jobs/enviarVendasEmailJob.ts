import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { EnviarVendasEmailService } from "@/modules/vendas/utils/EnviarVendasEmailService";
import log from "@/util/logger";

export const enviarVendasEmailJob: CronJobDefinition = {
    name: "Enviar Vendas Email",
    key: "process_vendas_enviar_email",
    label: "Vendas — Envio de emails de confirmação de pagamento e relatórios.",
    manualTrigger: true,
    schedule: Config.CRON_ENVIAR_VENDAS_EMAIL,
    enabled: Config.CRON_ENVIAR_VENDAS_EMAIL_ENABLED,
    runOnInit: true,
    task: async () => {
        log.info("[EnviarVendasEmail] Iniciando busca de vendas para envio de email");

        const vendasParaEnvio = await s4DotzClient.vendasHeader.findMany({
            where: { status: StatusVendas.ENVIANDO_EMAIL },
            select: { id: true },
            take: 50,
        });

        if (vendasParaEnvio.length === 0) {
            log.info("[EnviarVendasEmail] Nenhuma venda para envio de email encontrada");
            return;
        }

        log.info(`[EnviarVendasEmail] ${vendasParaEnvio.length} vendas encontradas para envio de email`);

        let enviados = 0;
        let erros = 0;
        const emailService = new EnviarVendasEmailService();

        for (const venda of vendasParaEnvio) {
            try {
                await emailService.execute({ vendasHeaderId: venda.id });

                await s4DotzClient.vendasHeader.update({
                    where: { id: venda.id },
                    data: {
                        status: StatusVendas.CONCLUIDO,
                        atualizadoEm: new Date(),
                    },
                });

                enviados++;
            } catch (error) {
                log.error(`[EnviarVendasEmail] Erro ao enviar email para venda ${venda.id}: %o`, error);

                try {
                    await s4DotzClient.vendasHeader.update({
                        where: { id: venda.id },
                        data: {
                            status: StatusVendas.ERRO_EMAIL,
                            atualizadoEm: new Date(),
                        },
                    });
                } catch (revertError) {
                    log.error(`[EnviarVendasEmail] Erro ao atualizar status ERRO_EMAIL da venda ${venda.id}: %o`, revertError);
                }

                erros++;
            }
        }

        log.info(`[EnviarVendasEmail] Resumo: ${enviados} emails enfileirados, ${erros} erros`);
    },
};
