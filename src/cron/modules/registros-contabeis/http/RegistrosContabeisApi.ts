import axios from "axios";
const https = require("https");
import { Config } from "@/config/config";
import { S4HanaCloudAuthenticationTokenService } from "@/util/services/auth-sap/AuthenticationTokenService";
import log from "@/util/logger";
import apm from "@/apm";
import {
  RegistrosContabeisApiResult,
  SapJournalEntryItem,
} from "@/cron/modules/registros-contabeis/types/registros-contabeis.types";

interface RegistrosContabeisApiParams {
  data: string;
  skip?: number;
  top?: number;
}

export class RegistrosContabeisApi {
  async execute({
    data,
    skip = 0,
    top = Config.SYNC_REGISTROS_CONTABEIS_PAGE_SIZE,
  }: RegistrosContabeisApiParams): Promise<RegistrosContabeisApiResult> {
    log.debug("[RegistrosContabeisApi] Pegando o token de autenticação");

    const authenticationToken = await new S4HanaCloudAuthenticationTokenService().execute({
      grant_type: Config.S4_HANA_CLOUD_GRANT_TYPE || "",
      client_id: Config.S4_HANA_CLOUD_CLIENT_ID || "",
      client_secret: Config.S4_HANA_CLOUD_CLIENT_SECRET || "",
    });

    log.debug(`[RegistrosContabeisApi] Token de autenticação obtido, Fazendo a requisição para o endpoint de registros contábeis : ${Config.S4_HANA_CLOUD_BASE_URL}/getJournalEntries Filtro data: ${data}`);

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // apenas para teste/homologação
    });

    const requestSpan = apm.startSpan("SAP GET /getJournalEntries");
    requestSpan?.addLabels({ filter_date: data });
    let response;
    try {
      const requestUrl = `${Config.S4_HANA_CLOUD_BASE_URL}/getJournalEntries`;
      const requestParams = { data, skip, top };

      response = await axios.get(requestUrl, {
        params: requestParams,
        headers: {
          Authorization: `Bearer ${authenticationToken.access_token}`,
          "Content-Type": "application/json",
        },
        httpsAgent,
      });
    } finally {
      requestSpan?.end();
    }

    const items = response.data as SapJournalEntryItem[];
    const totalItens = this.parseTotalItensHeader(response.headers);
    log.debug(`[RegistrosContabeisApi] Recebidos ${items.length} itens (total-itens=${totalItens}, skip=${skip}, top=${top})`);

    return {
      items,
      totalItens,
      skip,
      top,
    };
  }

  private parseTotalItensHeader(headers: Record<string, unknown>): number {
    const raw =
      headers["total-itens"] ??
      headers["Total-Itens"] ??
      headers["total_itens"];

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  }
}
