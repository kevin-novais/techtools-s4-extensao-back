import { rabbitmqConnection, QUEUES } from "@/queue/config/rabbitmq";
import {
  IntegrarVexpensesSAPMessage,
  VexpensesSAPIntegrationQueueType,
} from "@/queue/types/vexpensesSapIntegrationQueue.types";
import { VexpensesIntegrationJson } from "@/cron/modules/vexpenses/types/expenses.types";
import log from "@/util/logger";

interface PublishVexpensesSAPIntegrationProps {
  protocolo: string;
  integracao: VexpensesIntegrationJson;
}

export async function publishVexpensesSAPIntegration(
  props: PublishVexpensesSAPIntegrationProps,
): Promise<void> {
  try {
    const channel = await rabbitmqConnection.getChannel();

    const message: IntegrarVexpensesSAPMessage = {
      type: VexpensesSAPIntegrationQueueType.INTEGRAR_VEXPENSES_SAP,
      timestamp: new Date(),
      data: {
        protocolo: props.protocolo,
        integracao: props.integracao,
      },
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));

    channel.sendToQueue(QUEUES.VEXPENSES_INTEGRATION, messageBuffer, {
      persistent: true,
      headers: {
        "x-retry-count": 0,
      },
    });

    log.info(`[VexpensesSAPIntegrationConsumer] Integracao ${props.protocolo} publicada na fila`);
  } catch (error) {
    log.error("[VexpensesSAPIntegrationConsumer] Erro ao publicar integração vExpenses: %o", error);
    throw error;
  }
}
