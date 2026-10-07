import axios from "axios";
import { Config } from "@/config/config";
const https = require("https");

interface S4HanaCloudAuthenticationTokenServiceProps {
  grant_type: string;
  client_id: string;
  client_secret: string;
}

interface S4HanaCloudAuthenticationTokenServiceResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  jti: string;
}

export class S4HanaCloudAuthenticationTokenService {
  async execute({ grant_type, client_id, client_secret }: S4HanaCloudAuthenticationTokenServiceProps) {
    const url = `${Config.S4_HANA_CLOUD_AUTH_URL}/oauth/token`

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // apenas para teste/homologação
    });
    
    const params = new URLSearchParams();
      params.append("grant_type", grant_type);
      params.append("client_id", client_id);
      params.append("client_secret", client_secret);

    const response = await axios.post(url, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      httpsAgent
    });

    return response.data as S4HanaCloudAuthenticationTokenServiceResponse;
  }
}
