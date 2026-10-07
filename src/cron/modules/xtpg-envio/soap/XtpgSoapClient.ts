/**
 * Cliente SOAP da XTPG (DeepXRT) - operação EnviarListaMovimentoCaixaAssinc.
 *
 * Resposta confirmada em homologação (lote): um bloco `<MovimentoRecebido>` por
 * movimento, cada um ecoando `<OrigemPk>` + `<ID>` + `<MensagemErro/>`. Por isso o
 * resultado é casado ao movimento enviado **por OrigemPk** (robusto a reordenação),
 * com fallback posicional. ID vazio (`00000000-...`) = rejeição.
 */
import axios, { AxiosInstance } from "axios";
import { Config } from "@/config/config";
import log from "@/util/logger";
import { buildSoapEnvelope } from "@/cron/modules/xtpg-envio/soap/buildSoapEnvelope";
import type {
    MovimentoResolvido,
    ResultadoLoteXtpg,
    ResultadoMovimentoXtpg,
} from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

const UUID_VAZIO = "00000000-0000-0000-0000-000000000000";

/** Primeiro valor de uma tag dentro de um trecho XML (ignora namespace; '' se ausente/auto-fechada). */
function firstTag(xml: string, tagLocalName: string): string {
    const re = new RegExp(`<(?:\\w+:)?${tagLocalName}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagLocalName}>`, "i");
    const m = re.exec(xml);
    return m ? m[1].trim() : "";
}

/** Extrai os blocos <MovimentoRecebido>...</MovimentoRecebido>. */
function extractBlocks(xml: string): string[] {
    const re = /<(?:\w+:)?MovimentoRecebido\b[\s\S]*?<\/(?:\w+:)?MovimentoRecebido>/gi;
    return xml.match(re) ?? [];
}

function isIdValido(id: string | null | undefined): boolean {
    if (!id) return false;
    const v = id.trim();
    return v.length > 0 && v !== UUID_VAZIO;
}

export class XtpgSoapClient {
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: Config.XTPG_API_BASE_URL,
            timeout: Config.XTPG_API_TIMEOUT_MS,
            headers: { "Content-Type": "text/xml; charset=utf-8" },
            // A XTPG responde 200 mesmo em erro de negócio; só tratamos 5xx como erro real.
            validateStatus: (status) => status >= 200 && status < 500,
        });
    }

    /** Envia um lote de movimentos e retorna o resultado por movimento (na ordem enviada). */
    async enviarLote(movimentos: MovimentoResolvido[]): Promise<ResultadoLoteXtpg> {
        const requestXml = buildSoapEnvelope({
            usuario: Config.XTPG_API_USUARIO,
            senha: Config.XTPG_API_SENHA,
            movimentos,
        });

        try {
            const response = await this.http.post(Config.XTPG_API_ENDPOINT, requestXml);
            const responseXml = typeof response.data === "string" ? response.data : String(response.data);

            if (response.status >= 400) {
                return this.resultadoErroLote(requestXml, responseXml, movimentos.length, `HTTP ${response.status} ao enviar lote XTPG`);
            }

            return this.parseResposta(requestXml, responseXml, movimentos);
        } catch (error) {
            const mensagem = error instanceof Error ? error.message : String(error);
            log.error(`[XtpgSoapClient] Falha ao enviar lote XTPG: ${mensagem}`);
            return this.resultadoErroLote(requestXml, null, movimentos.length, mensagem);
        }
    }

    private parseResposta(
        requestXml: string,
        responseXml: string,
        movimentos: MovimentoResolvido[],
    ): ResultadoLoteXtpg {
        const blocks = extractBlocks(responseXml);

        if (blocks.length === 0) {
            const erroLote =
                firstTag(responseXml, "MensagemErro") ||
                firstTag(responseXml, "faultstring") ||
                "Resposta XTPG sem MovimentoRecebido";
            return this.resultadoErroLote(requestXml, responseXml, movimentos.length, erroLote);
        }

        const porPk = new Map<string, { id: string; erro: string }>();
        const parsed = blocks.map((b) => {
            const item = { id: firstTag(b, "ID"), erro: firstTag(b, "MensagemErro"), pk: firstTag(b, "OrigemPk") };
            if (item.pk) porPk.set(item.pk, { id: item.id, erro: item.erro });
            return item;
        });

        let resultados: ResultadoMovimentoXtpg[];

        if (parsed.length === movimentos.length) {
            // Caso normal: o XTPG devolve 1 bloco por movimento, na ordem enviada.
            // Casamento POSICIONAL — correto inclusive quando OrigemPk se repete no lote
            // (realizado: OrigemPk = Nr_Doc_SAP, sem o item, pode repetir entre linhas do mesmo doc).
            resultados = movimentos.map((mov, i) => {
                const blk = parsed[i];
                const pk = mov.byTag.OrigemPk;
                if (pk && blk.pk && pk !== blk.pk) {
                    log.warn(`[XtpgSoapClient] OrigemPk divergente na posição ${i}: enviado=${pk} recebido=${blk.pk}`);
                }
                return this.montaResultado(blk.id, blk.erro);
            });
        } else {
            // Contagem divergente: melhor-esforço por OrigemPk; sem retorno => erro.
            log.warn(
                `[XtpgSoapClient] Retornos (${parsed.length}) != enviados (${movimentos.length}); casando por OrigemPk.`,
            );
            resultados = movimentos.map((mov) => {
                const hit = mov.byTag.OrigemPk ? porPk.get(mov.byTag.OrigemPk) : undefined;
                return hit
                    ? this.montaResultado(hit.id, hit.erro)
                    : { idXrt: null, mensagemErro: "Sem retorno correspondente da XTPG", sucesso: false };
            });
        }

        return { requestXml, responseXml, resultados, erroLote: null };
    }

    private montaResultado(id: string | undefined, erro: string | undefined): ResultadoMovimentoXtpg {
        const valido = isIdValido(id);
        return {
            idXrt: valido ? id!.trim() : null,
            mensagemErro: valido ? null : (erro?.trim() || "Movimento rejeitado pela XTPG"),
            sucesso: valido,
        };
    }

    private resultadoErroLote(
        requestXml: string,
        responseXml: string | null,
        quantidade: number,
        erroLote: string,
    ): ResultadoLoteXtpg {
        const resultados: ResultadoMovimentoXtpg[] = Array.from({ length: quantidade }, () => ({
            idXrt: null,
            mensagemErro: erroLote,
            sucesso: false,
        }));
        return { requestXml, responseXml, resultados, erroLote };
    }
}
