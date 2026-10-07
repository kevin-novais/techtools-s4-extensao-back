import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";
import { ConsultarBoletoBankPlusService } from "@/cron/modules/bankplus-invent/services/ConsultarBoletoBankPlusService";
import {
    extrairMensagemErroBankPlus,
    isBoletoAindaNaoEmitido,
    resumirErroBankPlus,
} from "@/cron/modules/bankplus-invent/utils/bankplusErrors";

const STATUSES_PERMITIDOS = new Set<StatusVendas>([
    StatusVendas.ERRO_BOLETO,
    StatusVendas.AGUARDANDO_BOLETO,
]);

interface VendasConsultarBoletoParams {
    vendasHeaderId: number;
    status: string;
}

export class VendasConsultarBoletoService {
    constructor(
        private readonly bankPlusService: ConsultarBoletoBankPlusService = new ConsultarBoletoBankPlusService(),
    ) {}

    async execute({ vendasHeaderId, status }: VendasConsultarBoletoParams) {
        if (!STATUSES_PERMITIDOS.has(status as StatusVendas)) {
            throw new AppError(
                `Boleto só pode ser consultado novamente quando a venda está com erro ou aguardando boleto (status atual: ${status})`,
                400,
            );
        }

        try {
            return await this.bankPlusService.execute({ vendasHeaderId });
        } catch (error) {
            const mensagem = extrairMensagemErroBankPlus(error);
            const novoStatus = isBoletoAindaNaoEmitido(error)
                ? StatusVendas.AGUARDANDO_BOLETO
                : StatusVendas.ERRO_BOLETO;

            try {
                await s4DotzClient.vendasHeader.update({
                    where: { id: vendasHeaderId },
                    data: {
                        status: novoStatus,
                        erroConsultaBoleto:
                            novoStatus === StatusVendas.ERRO_BOLETO ? mensagem : null,
                        retornoConsultaBoletoInvent: mensagem,
                        dataUltimaConsultaBoleto: new Date(),
                        atualizadoEm: new Date(),
                    },
                });
            } catch (updateError) {
                log.error(`[VendasConsultarBoletoService] Erro ao atualizar venda ${vendasHeaderId}: %o`, updateError);
            }

            throw new AppError(resumirErroBankPlus(error), 502);
        }
    }
}
