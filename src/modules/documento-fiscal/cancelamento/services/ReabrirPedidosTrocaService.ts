import getDotzStageClient from "@/database/clients/dotzStageClient";
import s4DotzClient from "@/database/clients/s4DotzClient";
import log from "@/util/logger";

export interface ReabrirPedidosTrocaResult {
    pedidos: number[];
    oporReabertos: number;
    por1Reabertos: number;
}

/**
 * (DTZ-279) Reabre no Analyzer (stage) os pedidos de troca cujo romaneio foi cancelado no SAP,
 * deixando-os disponíveis para integrar novamente com outro romaneio.
 *
 * Espelha o SQL prescrito no chamado:
 *   UPDATE OPOR SET DocStatus = 'O' WHERE U_DOTZNRPED in (<pedidos do header>)
 *   UPDATE POR1 SET LineStatus = 'O', U_DocEntryNF = null WHERE DocEntry in (<OPOR desses pedidos>)
 *
 * Os pedidos vêm de `documento_fiscal_detail.codigo_pedido_parceiro` (= OPOR.U_DOTZNRPED). Como
 * OPOR/POR1 vivem no banco stage (cliente dotz-stage) e o documento fiscal no s4_extensao_dotz, a
 * junção do SQL do chamado é feita em duas etapas — uma por banco — em vez de um join cross-database.
 */
export class ReabrirPedidosTrocaService {
    async execute(documentoFiscalHeaderId: number): Promise<ReabrirPedidosTrocaResult> {
        const detalhes = await s4DotzClient.documentoFiscalDetalhe.findMany({
            where: { documentoFiscalHeaderId },
            select: { codigoPedidoParceiro: true },
        });

        const pedidos = [
            ...new Set(
                detalhes
                    .map((detalhe: { codigoPedidoParceiro: string | null }) => detalhe.codigoPedidoParceiro)
                    .filter((valor: string | null): valor is string => Boolean(valor))
                    .map((valor: string) => Number(valor))
                    .filter((valor: number) => Number.isInteger(valor)),
            ),
        ] as number[];

        if (!pedidos.length) {
            log.warn(
                `[ReabrirPedidosTroca] Header ${documentoFiscalHeaderId} sem pedidos de parceiro para reabrir`,
            );
            return { pedidos: [], oporReabertos: 0, por1Reabertos: 0 };
        }

        const stage = getDotzStageClient();

        const opors = await stage.OPOR.findMany({
            where: { U_DOTZNRPED: { in: pedidos } },
            select: { DocEntry: true },
        });
        const docEntries = opors.map((opor: { DocEntry: number }) => opor.DocEntry);

        const oporUpdate = await stage.OPOR.updateMany({
            where: { U_DOTZNRPED: { in: pedidos } },
            data: { DocStatus: "O" },
        });

        let por1Update = { count: 0 };
        if (docEntries.length) {
            por1Update = await stage.POR1.updateMany({
                where: { DocEntry: { in: docEntries } },
                data: { LineStatus: "O", U_DocEntryNF: null },
            });
        }

        log.info(
            `[ReabrirPedidosTroca] Header ${documentoFiscalHeaderId}: ${oporUpdate.count} OPOR e ` +
                `${por1Update.count} POR1 reabertos (pedidos: ${pedidos.join(", ")})`,
        );

        return {
            pedidos,
            oporReabertos: oporUpdate.count,
            por1Reabertos: por1Update.count,
        };
    }
}
