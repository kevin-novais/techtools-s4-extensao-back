import { VexpensesIntegrationJson } from "@/cron/modules/vexpenses/types/expenses.types";

export enum VexpensesSAPIntegrationQueueType {
  INTEGRAR_VEXPENSES_SAP = "INTEGRAR_VEXPENSES_SAP",
}

export interface IntegrarVexpensesSAPMessage {
  type: VexpensesSAPIntegrationQueueType.INTEGRAR_VEXPENSES_SAP;
  timestamp: Date;
  data: {
    protocolo: string;
    integracao: VexpensesIntegrationJson;
  };
}

export type VexpensesSAPIntegrationQueueMessage = IntegrarVexpensesSAPMessage;
