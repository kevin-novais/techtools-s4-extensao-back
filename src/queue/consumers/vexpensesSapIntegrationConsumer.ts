import { type Channel, type ConsumeMessage } from "amqplib";
import { rabbitmqConnection, QUEUES } from "@/queue/config/rabbitmq";
import {
  VexpensesSAPIntegrationQueueMessage,
  VexpensesSAPIntegrationQueueType,
} from "@/queue/types/vexpensesSapIntegrationQueue.types";
import log from "@/util/logger";
import AppError from "@/util/AppError";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";
import apm from '@/apm';

const MAX_RETRIES = 2;
const VEXPENSES_PREFETCH = 10;
const integracaoSapService = new IntegracaoSapCreateJournalEntryService();

export async function processVexpensesIntegrationMessage(
  message: VexpensesSAPIntegrationQueueMessage,
): Promise<void> {
  if (message.type !== VexpensesSAPIntegrationQueueType.INTEGRAR_VEXPENSES_SAP) {
    log.warn(`Tipo de mensagem desconhecido: ${(message as any).type}`);
    throw new Error("Tipo de mensagem desconhecido");
  }

  const { protocolo, integracao } = message.data;
  const requestJson = JSON.stringify(integracao);

  log.info(`[VexpensesSAPIntegrationConsumer] Enviando integracao ${protocolo} ao SAP`);
  const response = await integracaoSapService.execute(integracao as any);

  await handleSapResponse(protocolo, response, requestJson);
}

async function handleSapResponse(protocolo: string, response: any, requestJson: string | null): Promise<void> {
  const responseJson = response?.data !== undefined ? JSON.stringify(response.data) : null;

  if (response?.status === 201) {
    const numeroDocumentoERP = response?.data?.numeroDocumentoERP || null;
    await updateControleExpenseStatus(protocolo, "INTEGRADO_SAP", null, numeroDocumentoERP, requestJson, responseJson);
    return;
  }

  const mensagem = response?.data?.mensagem || `Status inesperado: ${response?.status ?? "NAO_INFORMADO"}`;
  await updateControleExpenseStatus(protocolo, "ERRO_INTEGRACAO_SAP", mensagem, null, requestJson, responseJson);
}

async function updateControleExpenseStatus(
  protocolo: string,
  status: string,
  errorMessage: string | null,
  codigoDocumentoERP?: string | null,
  request?: string | null,
  response?: string | null,
): Promise<void> {
  await s4DotzClient.controleExpense.updateMany({
    where: {
      codigoProtocoloVexpenses: protocolo,
    },
    data: {
      status,
      codigoDocumentoERP: codigoDocumentoERP ?? undefined,
      error_message: errorMessage ?? undefined,
      request: request ?? undefined,
      response: response ?? undefined,
      dataImportacao: status === "INTEGRADO_SAP" ? new Date() : undefined,
      atualizadoEm: new Date(),
    },
  });

  log.info(
    `[VexpensesSAPIntegrationConsumer] ControleExpense atualizado. Protocolo=${protocolo}, Status=${status}`,
  );
}

function extractErrorMessage(error: any): string {
  if (error?.response?.data?.mensagem) {
    const mensagem = error.response.data.mensagem;
    return typeof mensagem === "string" ? mensagem : JSON.stringify(mensagem);
  }

  if (error?.message) {
    return error.message;
  }

  return "Erro desconhecido";
}

function extractProtocolo(messageContent: string): string | null {
  try {
    const parsed = JSON.parse(messageContent) as VexpensesSAPIntegrationQueueMessage;
    return parsed?.data?.protocolo ?? null;
  } catch {
    return null;
  }
}

function extractRequest(messageContent: string): string | null {
  try {
    const parsed = JSON.parse(messageContent) as VexpensesSAPIntegrationQueueMessage;
    return parsed?.data?.integracao ? JSON.stringify(parsed.data.integracao) : null;
  } catch {
    return null;
  }
}

async function run(channel: Channel, msg: ConsumeMessage): Promise<void> {
  const messageContent = msg.content.toString();
  const protocolo = extractProtocolo(messageContent);
  const requestJson = extractRequest(messageContent);

  try {
    const vexpensesMessage: VexpensesSAPIntegrationQueueMessage = JSON.parse(messageContent);
    const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

    log.info(
      `[VexpensesSAPIntegrationConsumer] Processando integracao (tentativa ${retryCount + 1}/${MAX_RETRIES})`,
    );

    await processVexpensesIntegrationMessage(vexpensesMessage);

    channel.ack(msg);
  } catch (error) {
    if (error instanceof AppError) {
      log.error(`[VexpensesSAPIntegrationConsumer] Erro de negocio: ${error.message}`);
      log.warn("[VexpensesSAPIntegrationConsumer] Mensagem descartada (erro de negócio)");
      if (protocolo) {
        await updateControleExpenseStatus(
          protocolo,
          "ERRO_INTEGRACAO_SAP",
          error.message,
          null,
          requestJson,
          (error as any)?.response?.data !== undefined ? JSON.stringify((error as any).response.data) : null,
        );
      }
      channel.ack(msg);
      return;
    }

    const message = extractErrorMessage(error);
    log.error(`[VexpensesSAPIntegrationConsumer] Erro ao processar mensagem: ${message}`);

    const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

    if (retryCount < MAX_RETRIES - 1) {
      log.warn(`[VexpensesSAPIntegrationConsumer] Reenviando mensagem (tentativa ${retryCount + 2}/${MAX_RETRIES})`);

      channel.sendToQueue(QUEUES.VEXPENSES_INTEGRATION, msg.content, {
        persistent: true,
        headers: {
          "x-retry-count": retryCount + 1,
        },
      });

      channel.ack(msg);
      return;
    }

    log.error(`[VexpensesSAPIntegrationConsumer] Falha apos ${MAX_RETRIES} tentativas. Enviando para DLQ.`);
    if (protocolo) {
      await updateControleExpenseStatus(
        protocolo,
        "ERRO_INTEGRACAO_SAP",
        message,
        null,
        requestJson,
        (error as any)?.response?.data !== undefined ? JSON.stringify((error as any).response.data) : null,
      );
    }
    channel.nack(msg, false, false);
  }
}

export async function startVexpensesSAPIntegrationConsumer(): Promise<void> {
  try {
    const channel = await rabbitmqConnection.getChannel();
    await channel.prefetch(VEXPENSES_PREFETCH);
    log.info(
      `[VexpensesSAPIntegrationConsumer] Prefetch configurado: ${VEXPENSES_PREFETCH}. Aguardando mensagens na fila ${QUEUES.VEXPENSES_INTEGRATION}`,
    );

    await channel.consume(
      QUEUES.VEXPENSES_INTEGRATION,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          await run(channel, msg);
        } catch(error) {
          // Registrar falha no APM
          apm.captureError(error instanceof Error ? error : new Error(String(error)));
        }
      },
      {
        noAck: false,
      },
    );

    log.info(`[VexpensesSAPIntegrationConsumer] Consumidor iniciado na fila ${QUEUES.VEXPENSES_INTEGRATION}`);
  } catch (error) {
    log.error("[VexpensesSAPIntegrationConsumer] Erro ao iniciar consumidor: %o", error);
    throw error;
  }
}
