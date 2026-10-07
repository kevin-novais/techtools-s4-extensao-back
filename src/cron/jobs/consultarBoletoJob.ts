import { CronJobDefinition } from "@/cron/CronManager";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { ConsultarBoletoBankPlusService } from "@/cron/modules/bankplus-invent/services/ConsultarBoletoBankPlusService";
import {
    extrairMensagemErroBankPlus,
    isBoletoAindaNaoEmitido,
    resumirErroBankPlus,
} from "@/cron/modules/bankplus-invent/utils/bankplusErrors";
import log from "@/util/logger";

export const consultarBoletoJob: CronJobDefinition = {
    name: "Consultar Boleto BankPlus",
    key: "process_vendas_consultar_boleto",
    label: "Vendas — Busca de boletos no BankPlus (Invent)",
    manualTrigger: true,
    schedule: Config.CRON_CONSULTAR_BOLETO,
    enabled: Config.CRON_CONSULTAR_BOLETO_ENABLED,
    task: async () => {
        log.info("[ConsultarBoletoJob] Iniciando busca de vendas aguardando boleto");

        const vendasAguardando = await s4DotzClient.vendasHeader.findMany({
            where: { status: { in: [StatusVendas.AGUARDANDO_BOLETO, StatusVendas.ERRO_BOLETO] } },
            select: { id: true },
            take: 50,
        });

        if (vendasAguardando.length === 0) {
            log.info("[ConsultarBoletoJob] Nenhuma venda aguardando boleto");
            return;
        }

        log.info(`[ConsultarBoletoJob] ${vendasAguardando.length} vendas aguardando boleto`);

        const service = new ConsultarBoletoBankPlusService();
        let sucesso = 0;
        let aguardando = 0;
        let erros = 0;

        for (const venda of vendasAguardando) {
            try {
                await service.execute({ vendasHeaderId: venda.id });
                sucesso++;
            } catch (error) {
                const mensagem = extrairMensagemErroBankPlus(error);
                const resumo = resumirErroBankPlus(error);

                // Invent retorna 404 quando o boleto ainda não foi emitido do lado do BankPlus
                // (não é uma falha nossa) — mantém AGUARDANDO_BOLETO para nova tentativa no
                // próximo ciclo do cron, em vez de marcar ERRO_BOLETO.
                if (isBoletoAindaNaoEmitido(error)) {
                    log.info(`[ConsultarBoletoJob] ${resumo} (venda ${venda.id}) — mantendo AGUARDANDO_BOLETO`);

                    try {
                        await s4DotzClient.vendasHeader.update({
                            where: { id: venda.id },
                            data: {
                                status: StatusVendas.AGUARDANDO_BOLETO,
                                erroConsultaBoleto: null,
                                retornoConsultaBoletoInvent: mensagem,
                                dataUltimaConsultaBoleto: new Date(),
                                atualizadoEm: new Date(),
                            },
                        });
                    } catch (updateError) {
                        log.error(`[ConsultarBoletoJob] Erro ao atualizar venda ${venda.id} (boleto ainda não emitido): %o`, updateError);
                    }

                    aguardando++;
                    continue;
                }

                log.error(`[ConsultarBoletoJob] Erro ao consultar boleto da venda ${venda.id}: ${resumo}`);

                try {
                    await s4DotzClient.vendasHeader.update({
                        where: { id: venda.id },
                        data: {
                            status: StatusVendas.ERRO_BOLETO,
                            erroConsultaBoleto: mensagem,
                            retornoConsultaBoletoInvent: mensagem,
                            dataUltimaConsultaBoleto: new Date(),
                            atualizadoEm: new Date(),
                        },
                    });
                } catch (updateError) {
                    log.error(`[ConsultarBoletoJob] Erro ao gravar ERRO_BOLETO na venda ${venda.id}: %o`, updateError);
                }

                erros++;
            }
        }

        log.info(`[ConsultarBoletoJob] Resumo: ${sucesso} boletos obtidos, ${aguardando} ainda aguardando emissão, ${erros} erros`);
    },
};
