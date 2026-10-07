import axios from "axios";
const https = require("https");
import { Config } from "@/config/config";
import { S4HanaCloudAuthenticationTokenService } from "@/util/services/auth-sap/AuthenticationTokenService";
import log from "@/util/logger";
import { IntegracaoSAPJson } from "@/modules/documento-fiscal/utils/BuildSapIntegration";

export class IntegracaoSapCreateJournalEntryService {
  async execute(integracaoJson: IntegracaoSAPJson) {


    log.info(`[IntegracaoSapCreateJournalEntryService] Pegando o token de autenticação`);
    const authenticationToken = await new S4HanaCloudAuthenticationTokenService().execute({
      grant_type: Config.S4_HANA_CLOUD_GRANT_TYPE || "",
      client_id: Config.S4_HANA_CLOUD_CLIENT_ID || "",
      client_secret: Config.S4_HANA_CLOUD_CLIENT_SECRET || "",
    });

    log.info(`[IntegracaoSapCreateJournalEntryService] Fazendo a requisição para o endpoint de contabilidade SAP`);
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // apenas para teste/homologação
    });
    
    const response = await axios.post(`${Config.S4_HANA_CLOUD_BASE_URL}/createJournalEntry`, integracaoJson, {
      headers: {
        "Authorization": `Bearer ${authenticationToken.access_token}`,
        "Content-Type": "application/json",
      },
      httpsAgent,
    });

    return response;
  }
}
