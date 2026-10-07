import axios from "axios";
import https from "node:https";
import { Config } from "@/config/config";
import AppError from "@/util/AppError";
import log from "@/util/logger";
import {
    BankPlusInventAuthResponse,
    BankPlusInventBoletoResponse,
} from "@/cron/modules/bankplus-invent/types/bankplus-invent.types";

type CachedToken = {
    token: string;
    expiresAtMs: number;
    issuedAtMs: number;
};

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

// O token do BankPlus carrega a versão do app "Cobrança" vigente no momento da emissão, e o
// bloqueio de versão (visto em 26/08/2026) só é validado nas chamadas protegidas, não no
// /authenticate — um token de uma versão antiga e não bloqueada continua funcionando até
// expirar (TTL de ~24h). Sem esse teto, um bloqueio novo no meio do caminho fica mascarado por
// até um dia inteiro (o cache segue "funcionando" com a versão antiga). Forçamos reautenticação
// bem antes disso pra refletir a versão atual com mais frequência.
const TOKEN_MAX_CACHE_MS = 5 * 60 * 1000;

export class BankPlusInventApi {
    private static cachedToken: CachedToken | null = null;

    async getBoletoPdf(documentoId: string): Promise<BankPlusInventBoletoResponse> {
        if (!documentoId?.trim()) {
            throw new AppError("[BankPlusInventApi] documentoId é obrigatório", 400);
        }

        try {
            return await this.requestBoletoPdf(documentoId);
        } catch (error) {
            if (!this.isUnauthorized(error)) {
                throw error;
            }

            log.warn("[BankPlusInventApi] 401 em /api/cobranca/pdfs — invalidando cache e retentando");
            BankPlusInventApi.cachedToken = null;
            return this.requestBoletoPdf(documentoId);
        }
    }

    private async requestBoletoPdf(documentoId: string): Promise<BankPlusInventBoletoResponse> {
        const token = await this.getValidToken();
        const baseURL = this.requireBaseUrl();

        log.info(`[BankPlusInventApi] Consultando boleto para documentoId=${documentoId}`);

        const httpsAgent = new https.Agent({
            rejectUnauthorized: process.env.NODE_ENV === "production",
        });

        const response = await axios.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/pdf",
            },
            responseType: "arraybuffer",
            httpsAgent,
        }).get<ArrayBuffer>("/api/cobranca/pdfs", {
            params: { documentoId },
        });

        return Buffer.from(response.data);
    }

    private async getValidToken(): Promise<string> {
        const cached = BankPlusInventApi.cachedToken;
        const dentroDoTetoDeCache = cached && Date.now() - cached.issuedAtMs < TOKEN_MAX_CACHE_MS;
        if (dentroDoTetoDeCache && Date.now() < cached.expiresAtMs - TOKEN_REFRESH_MARGIN_MS) {
            return cached.token;
        }

        const auth = await this.authenticate();
        BankPlusInventApi.cachedToken = {
            token: auth.token,
            expiresAtMs: auth.expiresIn * 1000,
            issuedAtMs: Date.now(),
        };
        return auth.token;
    }

    private async authenticate(): Promise<BankPlusInventAuthResponse> {
        const baseURL = this.requireBaseUrl();
        const username = Config.BANKPLUS_INVENT_USERNAME;
        const password = Config.BANKPLUS_INVENT_PASSWORD;

        if (!username || !password) {
            throw new AppError("[BankPlusInventApi] credenciais BankPlus não configuradas", 500);
        }

        log.info("[BankPlusInventApi] Autenticando no BankPlus Invent");

        const httpsAgent = new https.Agent({
            rejectUnauthorized: process.env.NODE_ENV === "production",
        });

        const response = await axios.create({
            baseURL,
            headers: {
                Aplicacao: Config.BANKPLUS_INVENT_APLICACAO,
                TenantId: Config.BANKPLUS_INVENT_TENANT_ID,
                "Content-Type": "application/json",
            },
            httpsAgent,
        }).post<BankPlusInventAuthResponse>("/authenticate", {
            username,
            Password: password,
        });

        const data = response.data;
        if (!data?.token || typeof data.expiresIn !== "number") {
            throw new AppError("[BankPlusInventApi] resposta de autenticação inválida", 502);
        }

        log.info("[BankPlusInventApi] Autenticado com sucesso");
        return data;
    }

    private requireBaseUrl(): string {
        const baseURL = Config.BANKPLUS_INVENT_BASE_URL;
        if (!baseURL) {
            throw new AppError("[BankPlusInventApi] BANKPLUS_INVENT_BASE_URL não configurada", 500);
        }
        return baseURL;
    }

    private isUnauthorized(error: unknown): boolean {
        return axios.isAxiosError(error) && error.response?.status === 401;
    }

    static resetTokenCacheForTests(): void {
        BankPlusInventApi.cachedToken = null;
    }
}
