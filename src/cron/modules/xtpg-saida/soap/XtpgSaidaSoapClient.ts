/**
 * Cliente SOAP da `Saida.asmx` (DeepXRT).
 *
 * - `listarMovimentos(status)` → ListarMovimentosContabeisPeloStatus
 * - `mudarStatusParContabil(...)` → MudarStatusMovimentoParContabil
 *
 * Sem autenticação (confirmado pelo suporte XTPG, homolog e prod).
 * Parser por regex (mesmo estilo do XtpgSoapClient da Entrada) – sem dependência
 * extra de parser XML.
 */
import axios, { AxiosInstance } from "axios";
import { Config } from "@/config/config";
import log from "@/util/logger";
import {
    buildListarMovimentosEnvelope,
    buildMudarStatusEnvelope,
    soapActionListarMovimentos,
    soapActionMudarStatus,
} from "@/cron/modules/xtpg-saida/soap/buildSaidaSoapEnvelope";
import type {
    MovimentoContabilXtpg,
    ResultadoListarMovimentos,
    ResultadoMudarStatus,
} from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

/** Primeiro valor de uma tag (ignora namespace; '' se ausente/auto-fechada). */
function firstTag(xml: string, tagLocalName: string): string {
    const re = new RegExp(`<(?:\\w+:)?${tagLocalName}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagLocalName}>`, "i");
    const m = re.exec(xml);
    return m ? m[1].trim() : "";
}

/**
 * Extrai os blocos de cada movimento da resposta de ListarMovimentos.
 * O item repetido no WSDL real é `<Contabil>`, aninhado em
 * `<ListarMovimentosContabeisPeloStatusResult>` (validado contra o homolog do DeepXRT).
 */
const ITEM_TAG = "Contabil";

function extractItemBlocks(xml: string): string[] {
    const re = new RegExp(`<(?:\\w+:)?${ITEM_TAG}\\b[\\s\\S]*?</(?:\\w+:)?${ITEM_TAG}>`, "gi");
    return xml.match(re) ?? [];
}

export function parseMovimento(block: string): MovimentoContabilXtpg {
    const extras: Record<string, string> = {};
    for (let i = 1; i <= 30; i++) extras[`FlexField${i}`] = firstTag(block, `FlexField${i}`);
    extras.Tipo = firstTag(block, "Tipo");
    extras.ApropriacaoCaixa = firstTag(block, "ApropriacaoCaixa");
    extras.DataOriginal = firstTag(block, "DataOriginal");
    extras.Critica = firstTag(block, "Critica");
    extras.Status = firstTag(block, "Status");

    // A conta contábil COMPLETA (G/L account) vem no FlexField12; a tag <ContaContabil>
    // traz só os 4 últimos dígitos e é ambígua (ex.: "0061" tanto para 2251-0061 quanto
    // para outro grupo). Todos os consumidores (de-para bancário por GLAccount, de-para
    // contábil gl_account_b1_xtpg e a agregação do LCM) casam pela conta completa, então
    // usamos FlexField12 com fallback para a tag curta quando vazio. (Marco/XTPG, 17/08)
    const contaCurta = firstTag(block, "ContaContabil");
    extras.ContaContabilCurta = contaCurta;

    return {
        pfjCodigo: firstTag(block, "PfjCodigo"),
        parContabil: firstTag(block, "ParContabil"),
        data: firstTag(block, "Data"),
        indCodigo: firstTag(block, "IndCodigo"),
        contaContabil: extras.FlexField12 || contaCurta,
        creditoDebito: firstTag(block, "CreditoDebito"),
        valor: firstTag(block, "Valor"),
        lote: firstTag(block, "Lote"),
        historico: firstTag(block, "Historico"),
        banCodigo: firstTag(block, "BanCodigo"),
        ageCodigo: firstTag(block, "AgeCodigo"),
        cntCodigo: firstTag(block, "CntCodigo"),
        mvtContador: firstTag(block, "MvtContador"),
        extras,
    };
}

export class XtpgSaidaSoapClient {
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: Config.XTPG_SAIDA_API_BASE_URL,
            timeout: Config.XTPG_API_TIMEOUT_MS,
            // A XTPG responde 200 mesmo em erro de negócio; só 5xx é erro de transporte.
            validateStatus: (status) => status >= 200 && status < 500,
        });
    }

    /** Lista os movimentos contábeis pendentes (status conforme legado B1). */
    async listarMovimentos(status: string): Promise<ResultadoListarMovimentos> {
        const requestXml = buildListarMovimentosEnvelope(status);
        try {
            const response = await this.http.post(Config.XTPG_SAIDA_API_ENDPOINT, requestXml, {
                headers: {
                    "Content-Type": "text/xml; charset=utf-8",
                    SOAPAction: `"${soapActionListarMovimentos()}"`,
                },
            });
            const responseXml = typeof response.data === "string" ? response.data : String(response.data);

            if (response.status >= 400) {
                return { movimentos: [], requestXml, responseXml, erro: `HTTP ${response.status} ao listar movimentos` };
            }

            const movimentos = extractItemBlocks(responseXml).map(parseMovimento);
            return { movimentos, requestXml, responseXml, erro: null };
        } catch (error) {
            const mensagem = error instanceof Error ? error.message : String(error);
            log.error(`[XtpgSaidaSoapClient] Falha ao listar movimentos: ${mensagem}`);
            return { movimentos: [], requestXml, responseXml: null, erro: mensagem };
        }
    }

    /**
     * Devolve o resultado ao XTPG. `critica` recebe o nº do LCM no sucesso
     * (ou a mensagem de erro). `status`: mesmo critério do legado B1 (C/E).
     */
    async mudarStatusParContabil(params: {
        parContabil: string;
        status: string;
        critica: string;
    }): Promise<ResultadoMudarStatus> {
        const requestXml = buildMudarStatusEnvelope(params);
        try {
            const response = await this.http.post(Config.XTPG_SAIDA_API_ENDPOINT, requestXml, {
                headers: {
                    "Content-Type": "text/xml; charset=utf-8",
                    SOAPAction: `"${soapActionMudarStatus()}"`,
                },
            });
            const responseXml = typeof response.data === "string" ? response.data : String(response.data);

            if (response.status >= 400) {
                return { sucesso: false, requestXml, responseXml, mensagem: `HTTP ${response.status} ao mudar status` };
            }

            const fault = firstTag(responseXml, "faultstring");
            if (fault) {
                return { sucesso: false, requestXml, responseXml, mensagem: fault };
            }

            // Retorno booleano da operação (quando presente no WSDL).
            const result = firstTag(responseXml, "MudarStatusMovimentoParContabilResult");
            const sucesso = result === "" || /true|1|ok|c/i.test(result);
            return { sucesso, requestXml, responseXml, mensagem: sucesso ? null : result };
        } catch (error) {
            const mensagem = error instanceof Error ? error.message : String(error);
            log.error(`[XtpgSaidaSoapClient] Falha ao mudar status PAR_CONTABIL ${params.parContabil}: ${mensagem}`);
            return { sucesso: false, requestXml, responseXml: null, mensagem };
        }
    }
}
