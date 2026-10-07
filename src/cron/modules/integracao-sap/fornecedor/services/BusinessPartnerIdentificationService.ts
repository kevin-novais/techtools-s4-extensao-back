import axios from "axios";
const https = require("https");
import { Config } from "@/config/config";
import { S4HanaCloudAuthenticationTokenService } from "@/util/services/auth-sap/AuthenticationTokenService";
import log from "@/util/logger";
import apm from "@/apm";

interface ParametersBusinessPartnerIdentification {
  data: string;
}


interface BusinessPartnerIndustria {
  tipoIndustria: string;
  descricaoIndustria: string;
}

interface ResponseBusinessPartnerIdentification {
  codigoSap: string;
  nome: string;
  codigoAnalyzer: string;
  ativo: boolean;
  cnpj: string;
  email: string;
  docFinanCodigo: string;
  docFinanNome: string;
  ie?: string;
  endereco?: string;
  municipio?: string;
  cep?: string;
  codigoPai?: string;
  industrias?: BusinessPartnerIndustria[];
}

export class BusinessPartnerIdentificationService {
  async execute({ data }: ParametersBusinessPartnerIdentification) {


    log.info(`[BusinessPartnerIdentificationService] Pegando o token de autenticação`);
    const authenticationToken = await new S4HanaCloudAuthenticationTokenService().execute({
      grant_type: Config.S4_HANA_CLOUD_GRANT_TYPE || "",
      client_id: Config.S4_HANA_CLOUD_CLIENT_ID || "",
      client_secret: Config.S4_HANA_CLOUD_CLIENT_SECRET || "",
    });

    log.info(`[BusinessPartnerIdentificationService] Token de autenticação obtido`);
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // apenas para teste/homologação
    });
    

    log.info(`[BusinessPartnerIdentificationService] Fazendo a requisição para o endpoint de identificação de parceiros`);

    const requestSpan = apm.startSpan("SAP GET /BusinessPartnerIdentification");
    requestSpan?.addLabels({ filter_date: data });
    let response;
    try {
      response = await axios.get(`${Config.S4_HANA_CLOUD_BASE_URL}/BusinessPartnerIdentification`, {
        params: { data },
        headers: {
          "Authorization": `Bearer ${authenticationToken.access_token}`,
          "Content-Type": "application/json",
        },
        httpsAgent,
      });
      requestSpan?.addLabels({ total_received: (response.data as ResponseBusinessPartnerIdentification[]).length });
    } finally {
      requestSpan?.end();
    }

    log.info(`[BusinessPartnerIdentificationService] Parceiros identificados com sucesso`);

    return response.data as ResponseBusinessPartnerIdentification[];
  } 
}
