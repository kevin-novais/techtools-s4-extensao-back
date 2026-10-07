/**
 * Orquestração compartilhada do envio XTPG (previsto e realizado).
 *
 * Fluxo por execução:
 *  1. lê linhas da view (já filtradas por status_para_envio is null);
 *  2. mapeia para MovimentoResolvido (tags ordenadas + byTag + origem) via spec do fluxo;
 *  3. quebra em lotes (batchSize configurável);
 *  4. por lote: grava HEADER (PROCESSANDO + request), grava DETAILs (espelho do payload),
 *     envia via SOAP, atualiza DETAILs (id_xrt / erro), faz o write-back em
 *     registros_contabeis (status_para_envio S/E + id_xrt) e fecha o HEADER.
 *
 * As subclasses (previsto/realizado) fornecem o spec, a leitura da view e os delegates
 * Prisma das tabelas de log correspondentes.
 */
import log from "@/util/logger";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { XtpgSoapClient } from "@/cron/modules/xtpg-envio/soap/XtpgSoapClient";
import { buildSoapEnvelope } from "@/cron/modules/xtpg-envio/soap/buildSoapEnvelope";
import {
    buildMovimentoResolvido,
    parseChaveRegistro,
    tagToDetailField,
    type XtpgViewRow,
} from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";
import type { XtpgFlowSpec } from "@/cron/modules/xtpg-envio/config/xtpgFieldMap";
import {
    XTPG_DETAIL_STATUS,
    XTPG_HEADER_STATUS,
    buildStatusParaEnvio,
    type MovimentoResolvido,
    type SavFieldsXtpg,
    type ResultadoLoteXtpg,
    type ResumoEnvioXtpg,
    type XtpgFluxo,
} from "@/cron/modules/xtpg-envio/types/xtpgEnvio.types";

/** Delegate mínimo de uma tabela Prisma de log (header ou detail). */
interface PrismaLogDelegate {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }>;
    update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>;
}

export interface XtpgEnvioServiceConfig {
    fluxo: XtpgFluxo;
    spec: XtpgFlowSpec;
    batchSize: number;
    maxPerRun: number;
    lerView: (maxPerRun: number) => Promise<XtpgViewRow[]>;
    headerDelegate: PrismaLogDelegate;
    detailDelegate: PrismaLogDelegate;
}

/** Monta o data do DETAIL (denormalizado) a partir do movimento resolvido. */
function detailDataFromMovimento(mov: MovimentoResolvido): Record<string, unknown> {
    const data: Record<string, unknown> = {
        origemTabela: mov.origem.tabela,
        origemDocEntry: mov.origem.chave,
    };
    for (const { tag } of mov.ordered) {
        data[tagToDetailField(tag)] = mov.byTag[tag] ?? null;
    }
    return data;
}

function chunk<T>(items: T[], size: number): T[][] {
    if (size <= 0) return [items];
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/**
 * Guard de reentrância por fluxo (módulo): impede que duas execuções do mesmo cron
 * se sobreponham (node-cron pode disparar de novo se a execução anterior demorar),
 * evitando duplo-pick dos mesmos registros antes da pré-marcação 'P'.
 */
const emExecucao = new Set<XtpgFluxo>();

export class EnviarXtpgBaseService {
    private readonly soapClient = new XtpgSoapClient();

    constructor(private readonly config: XtpgEnvioServiceConfig) {}

    async execute(): Promise<ResumoEnvioXtpg> {
        const { fluxo, batchSize, maxPerRun } = this.config;
        const tag = `[EnviarXtpg:${fluxo}]`;

        const vazio = { totalLidos: 0, totalLotes: 0, totalEnviados: 0, totalErros: 0 };

        if (emExecucao.has(fluxo)) {
            log.warn(`${tag} Execução anterior ainda em andamento — pulando este disparo.`);
            return vazio;
        }
        emExecucao.add(fluxo);

        try {
            const rows = await this.config.lerView(maxPerRun);
            if (rows.length === 0) {
                log.info(`${tag} Nenhum registro a enviar.`);
                return vazio;
            }

            const movimentos = rows.map((row) => buildMovimentoResolvido(row, this.config.spec));
            const resumo = await this.processar(movimentos);

            log.info(
                `${tag} Concluído: lidos=${resumo.totalLidos} lotes=${resumo.totalLotes} enviados=${resumo.totalEnviados} erros=${resumo.totalErros}`,
            );

            return resumo;
        } finally {
            emExecucao.delete(fluxo);
        }
    }

    /**
     * Processa um conjunto de movimentos já resolvidos (quebra em lotes, envia e loga).
     * Reutilizado pelo cron (após ler a view) e pelo reprocessamento (movimentos
     * reconstruídos a partir do DETAIL).
     */
    async processar(movimentos: MovimentoResolvido[]): Promise<ResumoEnvioXtpg> {
        if (movimentos.length === 0) {
            return { totalLidos: 0, totalLotes: 0, totalEnviados: 0, totalErros: 0 };
        }

        const lotes = chunk(movimentos, this.config.batchSize);
        let totalEnviados = 0;
        let totalErros = 0;
        for (const lote of lotes) {
            const { enviados, erros } = await this.processarLote(lote);
            totalEnviados += enviados;
            totalErros += erros;
        }

        return {
            totalLidos: movimentos.length,
            totalLotes: lotes.length,
            totalEnviados,
            totalErros,
        };
    }

    private async processarLote(lote: MovimentoResolvido[]): Promise<{ enviados: number; erros: number }> {
        // Monta o envelope ANTES de criar o header (persiste o payload mesmo se falhar).
        const requestXml = buildSoapEnvelope({
            usuario: Config.XTPG_API_USUARIO,
            senha: Config.XTPG_API_SENHA,
            movimentos: lote,
        });

        const header = await this.config.headerDelegate.create({
            data: {
                status: XTPG_HEADER_STATUS.PROCESSANDO,
                totalRegistros: lote.length,
                request: requestXml,
            },
        });

        // DETAILs (espelho do payload; status inicial ENVIADO, ajustado após resposta).
        const detailIds: number[] = [];
        for (const mov of lote) {
            const created = await this.config.detailDelegate.create({
                data: {
                    headerId: header.id,
                    status: XTPG_DETAIL_STATUS.ENVIADO,
                    ...detailDataFromMovimento(mov),
                },
            });
            detailIds.push(created.id);
        }

        // IDEMPOTÊNCIA: marca os registros como 'P' (processando) ANTES do POST.
        // Como a view só retorna status nulo, um crash entre o POST e a finalização
        // NÃO reenvia o registro (ele já saiu da view). Fica para revisão/decisão da view.
        const statusProcessando = buildStatusParaEnvio(this.config.fluxo, "PROCESSANDO");
        await this.marcarRegistros(lote.map((m) => ({ chave: m.origem.chave, status: statusProcessando, idXrt: null })));

        const resultado = await this.soapClient.enviarLote(lote);

        let enviados = 0;
        let erros = 0;
        const finalizacoes: Array<{
            chave: string | null;
            status: string;
            idXrt: string | null;
            savFields: SavFieldsXtpg | null;
            envioId: number | null;
            writeBack?: { ultPkEnviada?: string | null };
        }> = [];

        for (let i = 0; i < lote.length; i += 1) {
            const r = resultado.resultados[i] ?? {
                idXrt: null,
                mensagemErro: "Sem resultado correspondente da XTPG",
                sucesso: false,
            };
            if (r.sucesso) enviados += 1;
            else erros += 1;

            await this.config.detailDelegate.update({
                where: { id: detailIds[i] },
                data: {
                    status: r.sucesso ? XTPG_DETAIL_STATUS.ENVIADO : XTPG_DETAIL_STATUS.ERRO,
                    idXrt: r.idXrt,
                    mensagemErro: r.mensagemErro,
                },
            });

            finalizacoes.push({
                chave: lote[i].origem.chave,
                status: r.sucesso
                    ? buildStatusParaEnvio(this.config.fluxo, "SUCESSO")
                    : buildStatusParaEnvio(this.config.fluxo, "ERRO"),
                idXrt: r.idXrt,
                // Snapshot sav_* + id do detail só no sucesso (savFields só vem no realizado).
                savFields: r.sucesso ? lote[i].savFields : null,
                envioId: r.sucesso ? detailIds[i] : null,
                writeBack: lote[i].writeBack,
            });
        }

        if (resultado.erroLote) {
            // Falha de transporte do lote (resposta desconhecida): NÃO finaliza.
            // Os registros permanecem em 'P' (não reenvia; revisão manual/via view).
            log.warn(
                `[EnviarXtpg:${this.config.fluxo}] Falha de transporte no lote — ${lote.length} registro(s) mantido(s) em '${statusProcessando}' para revisão: ${resultado.erroLote}`,
            );
        } else {
            // Finaliza status em registros_contabeis (S + id_xrt | E).
            await this.marcarRegistros(finalizacoes);
        }

        await this.config.headerDelegate.update({
            where: { id: header.id },
            data: {
                status: this.resolveHeaderStatus(resultado, enviados),
                request: resultado.requestXml,
                response: resultado.responseXml,
                mensagemErro: resultado.erroLote,
            },
        });

        return { enviados, erros };
    }

    private buildMarcarData(item: {
        status: string;
        idXrt: string | null;
        savFields?: SavFieldsXtpg | null;
        envioId?: number | null;
        writeBack?: { ultPkEnviada?: string | null };
    }): Record<string, unknown> {
        const data: Record<string, unknown> = { StatusParaEnvio: item.status };
        if (item.status !== buildStatusParaEnvio(this.config.fluxo, "SUCESSO")) return data;
        data.IdXRT = item.idXrt;
        if (item.savFields) {
            data.SavClearAccDoc = item.savFields.savClearAccDoc;
            data.SavClearDocFiscalYear = item.savFields.savClearDocFiscalYear;
            data.SavClearItem = item.savFields.savClearItem;
            data.SavRevDoc = item.savFields.savRevDoc;
            data.SavRevDocFiscalYear = item.savFields.savRevDocFiscalYear;
        }
        if (item.envioId != null) data.EnvioID = item.envioId;
        if (item.writeBack?.ultPkEnviada != null) data.UltPkEnviada = item.writeBack.ultPkEnviada;
        return data;
    }

    /** Atualiza registros_contabeis.status_para_envio (e id_xrt em sucesso) pela PK composta. */
    private async marcarRegistros(
        items: Array<{
            chave: string | null;
            status: string;
            idXrt: string | null;
            savFields?: SavFieldsXtpg | null;
            envioId?: number | null;
            writeBack?: { ultPkEnviada?: string | null };
        }>,
    ): Promise<void> {
        for (const item of items) {
            const pk = parseChaveRegistro(item.chave);
            if (!pk) {
                log.warn(`[EnviarXtpg:${this.config.fluxo}] Chave inválida p/ marcar registro: "${item.chave}"`);
                continue;
            }

            try {
                await s4DotzClient.accountingDocumentItem.update({
                    where: {
                        CompanyCode_FiscalYear_AccountingDocument_AccountingDocumentItem: pk,
                    },
                    data: this.buildMarcarData(item),
                });

                const enviado = item.status === buildStatusParaEnvio(this.config.fluxo, "SUCESSO");
                if (enviado && this.config.spec.ultDocPgtoSelfColumn) {
                    await this.copiarUltDocPgto(pk, this.config.spec.ultDocPgtoSelfColumn);
                }

                if (enviado && item.savFields) {
                    await this.marcarDocumentoReferencia(pk.CompanyCode, item.savFields, item.status);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log.error(
                    `[EnviarXtpg:${this.config.fluxo}] Falha ao marcar registros_contabeis (${item.chave}=${item.status}): ${msg}`,
                );
            }
        }
    }

    private async copiarUltDocPgto(
        pk: { CompanyCode: string; FiscalYear: string; AccountingDocument: string; AccountingDocumentItem: string },
        selfColumn: string,
    ): Promise<void> {
        await s4DotzClient.$executeRawUnsafe(
            `UPDATE s4_extensao_dotz.dbo.registros_contabeis
             SET Ult_Doc_Pgto = [${selfColumn}]
             WHERE company_code = @P1 AND fiscal_year = @P2 AND accounting_document = @P3 AND accounting_document_item = @P4`,
            pk.CompanyCode,
            pk.FiscalYear,
            pk.AccountingDocument,
            pk.AccountingDocumentItem,
        );
    }

    /**
     * (Realizado, DTZ-244/245) 2º update do envio: marca o documento de REFERÊNCIA (compensador)
     * com o `status` de sucesso. A linha do compensador é identificada por:
     *   company_code + fiscal_year(=savClearDocFiscalYear)
     *   + clearing_accounting_document(=savClearAccDoc) + clearing_item(=savClearItem).
     * O documento e o item são casados pelas colunas de compensação (`clearing_accounting_document`
     * / `clearing_item`) e NÃO por `accounting_document`/`accounting_document_item`: o compensador
     * tem a linha de G/L (contrapartida) e a do parceiro; só a do parceiro carrega os clearing_* do
     * item original, e é essa que deve ser marcada. Os sav_* já vêm resolvidos com fallback p_*
     * (DTZ-245) para o cenário de reversão. Pula se faltar algum campo.
     */
    private async marcarDocumentoReferencia(
        companyCode: string,
        savFields: SavFieldsXtpg,
        status: string,
    ): Promise<void> {
        const { savClearDocFiscalYear, savClearAccDoc, savClearItem } = savFields;
        if (!savClearDocFiscalYear || !savClearAccDoc || !savClearItem) return;

        await s4DotzClient.$executeRawUnsafe(
            `UPDATE s4_extensao_dotz.dbo.registros_contabeis
             SET status_para_envio = @P1
             WHERE company_code = @P2 AND fiscal_year = @P3 AND clearing_accounting_document = @P4 AND clearing_item = @P5`,
            status,
            companyCode,
            savClearDocFiscalYear,
            savClearAccDoc,
            savClearItem,
        );
    }

    private resolveHeaderStatus(resultado: ResultadoLoteXtpg, enviados: number): string {
        if (resultado.erroLote || enviados === 0) return XTPG_HEADER_STATUS.ERRO;
        if (enviados < resultado.resultados.length) return XTPG_HEADER_STATUS.PARCIAL;
        return XTPG_HEADER_STATUS.ENVIADO;
    }
}
