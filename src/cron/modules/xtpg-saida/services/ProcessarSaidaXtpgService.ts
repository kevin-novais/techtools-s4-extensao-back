/**
 * Orquestra o fluxo de SAÍDA XTPG (DTZ-227):
 *   1. Lista movimentos contábeis pendentes no XTPG (ListarMovimentosContabeisPeloStatus).
 *   2. Agrupa por PAR_CONTABIL (1 LCM por grupo).
 *   3. Fila SAP: cria o LCM no S/4 (createJournalEntry) – grava status_sap, codigo_sap.
 *   4. Fila XTPG: devolve o status (MudarStatusMovimentoParContabil).
 *      - Sucesso: status C, critica = codigo_sap.
 *      - Erro (de-para/empresa/config faltando ou erro no S/4): status E, critica = motivo,
 *        para o PAR sair de "aguardando" e o time do XTPG ver por que não carregou (Marco 20/08).
 *        Sem gate: vale inclusive para PAR pendente por mapeamento incompleto.
 *      - "Mesma conta": se débito e crédito do PAR caem na mesma conta S/4, a linha
 *        agregada zera e o S/4 rejeita com HTTP 400 sem descrição. Detecta antes de
 *        enviar e devolve crítica clara (status E) sem depender do gate (Marco 21/08).
 *
 * Lote atômico (DTZ-302): os PARs são agrupados por LOTE (mov.lote) e processados em fases —
 *   (1) prepara/valida/monta o LCM de todos os PARs do lote sem enviar; se QUALQUER PAR falhar
 *       na validação, o lote inteiro é cancelado (nenhum LCM é enviado; todos devolvidos com erro);
 *   (2a) integra TODOS os PARs válidos no S/4 (fila SAP) — ainda SEM tocar no XTPG;
 *   (2b) só depois que o lote inteiro foi integrado é que o OK é enviado ao XTPG (MudarStatus C);
 *        se algum PAR falhou no S/4, cancela o lote: ESTORNA os LCMs já criados dos outros PARs
 *        (Marco 26/08) reutilizando o createJournalEntry com os valores invertidos (lançamento
 *        compensador — single-LCM via BTP, sem endpoint de reversão) e devolve E a todos, sem OK.
 * O OK só sair no fim evita OK-ar um PAR e o lote acabar cancelado por erro num PAR seguinte
 * (Marco 26/08). PARs com lote vazio caem em grupos individuais (sem atomicidade cruzada).
 *
 * Idempotência / matriz de reprocessamento (gate = status_sap):
 *   - status_sap = INTEGRADO  -> PULA a fila SAP (nunca recria o LCM); só refaz a fila XTPG.
 *   - status_sap = ERRO       -> reprocessa a fila SAP.
 *   - status_xtpg = ERRO      -> reprocessa só a fila XTPG até concluir / intervenção.
 * Chave anti-duplicidade: cia_sap + parcontabil (Header.chaveValidacao).
 *
 * SEGURANÇA: o envio efetivo ao S/4 só ocorre com Config.XTPG_SAIDA_ENVIO_SAP_HABILITADO=true.
 * Enquanto o mapeamento está incompleto (centro de custo / tipo de documento / contrato
 * House Bank), o LCM é montado e gravado em request_sap mas NÃO é enviado.
 */
import log from "@/util/logger";
import { Config } from "@/config/config";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { IntegracaoSapCreateJournalEntryService } from "@/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry";
import { extractSapIntegrationAxiosError } from "@/modules/documento-fiscal/utils/integracao/extractSapIntegrationAxiosError";
import { XtpgSaidaSoapClient } from "@/cron/modules/xtpg-saida/soap/XtpgSaidaSoapClient";
import { CiaDeParaRepository } from "@/cron/modules/xtpg-saida/repositories/CiaDeParaRepository";
import { ConfiguracaoContabilXtpgRepository } from "@/cron/modules/xtpg-saida/repositories/ConfiguracaoContabilXtpgRepository";
import { ContasContabeisDeParaRepository } from "@/cron/modules/xtpg-saida/repositories/ContasContabeisDeParaRepository";
import {
    ContasBancariasDeParaRepository,
    HouseBankRef,
} from "@/cron/modules/xtpg-saida/repositories/ContasBancariasDeParaRepository";
import { buildLcmFromMovimentos, detectarContasZeradas, marcarTextoSaida } from "@/cron/modules/xtpg-saida/mappers/buildLcmFromMovimentos";
import type { LoteParContabil, MovimentoContabilXtpg } from "@/cron/modules/xtpg-saida/types/xtpgSaida.types";

export interface ResumoSaida {
    totalMovimentos: number;
    totalLotes: number;
    lcmCriados: number;
    erros: number;
    erroListagem: string | null;
}

/** Agrupa movimentos por PAR_CONTABIL. */
export function agruparPorParContabil(movimentos: MovimentoContabilXtpg[]): LoteParContabil[] {
    const map = new Map<string, LoteParContabil>();
    for (const mov of movimentos) {
        const chave = mov.parContabil;
        let lote = map.get(chave);
        if (!lote) {
            lote = { parContabil: chave, pfjCodigo: mov.pfjCodigo, data: mov.data, lote: mov.lote, movimentos: [] };
            map.set(chave, lote);
        }
        lote.movimentos.push(mov);
    }
    return [...map.values()];
}

/**
 * (DTZ-302) Agrupa os PARs por LOTE (`mov.lote`) para o processamento atômico. PARs com
 * lote vazio caem em grupos INDIVIDUAIS (chave = próprio PAR_CONTABIL) para não sofrerem
 * cancelamento cruzado indevido.
 */
export function agruparPorLote(pars: LoteParContabil[]): LoteParContabil[][] {
    const map = new Map<string, LoteParContabil[]>();
    for (const par of pars) {
        const chave = par.lote && par.lote.trim() !== "" ? `L:${par.lote}` : `P:${par.parContabil}`;
        const grupo = map.get(chave);
        if (grupo) grupo.push(par);
        else map.set(chave, [par]);
    }
    return [...map.values()];
}

/** Resultado da fase de preparo de um PAR (validação + montagem, sem envio). DTZ-302. */
export interface PreparoPar {
    lote: LoteParContabil;
    headerId: number | null;
    chaveValidacao: string;
    integracaoJson: ReturnType<typeof buildLcmFromMovimentos> | null;
    descricaoErro: string | null;
    jaIntegrado: boolean;
}

/**
 * (DTZ-302) Decide se um LOTE deve ser cancelado: cancela se QUALQUER PAR pendente
 * (não já integrado) tiver erro de validação. Função pura para teste unitário.
 */
export function decidirCancelamentoLote(preparos: PreparoPar[]): {
    cancelar: boolean;
    parComErro: string | null;
    motivo: string | null;
} {
    const comErro = preparos.find((p) => !p.jaIntegrado && p.descricaoErro);
    if (!comErro) return { cancelar: false, parComErro: null, motivo: null };
    return { cancelar: true, parComErro: comErro.lote.parContabil, motivo: comErro.descricaoErro };
}

/** Resultado da integração de um PAR no S/4 (fase 2a). DTZ-302. */
export interface ResultadoIntegracaoSap {
    prep: PreparoPar;
    sucesso: boolean;
    codigoSap: string | null;
    erro: string | null;
}

/**
 * (DTZ-302, Marco 26/08) Quando um PAR do lote falha no S/4, os LCMs já criados dos outros PARs
 * do mesmo lote precisam ser ESTORNADOS (o /createJournalEntry é single-LCM via BTP, sem
 * changeset atômico). Retorna os PARs a estornar = os que integraram com sucesso e têm nº de LCM.
 * Função pura para teste unitário.
 */
export function selecionarParaEstorno(resultados: ResultadoIntegracaoSap[]): ResultadoIntegracaoSap[] {
    return resultados.filter((r) => r.sucesso && !!r.codigoSap);
}

export class ProcessarSaidaXtpgService {
    private readonly soap = new XtpgSaidaSoapClient();
    private readonly ciaRepo = new CiaDeParaRepository();
    private readonly configRepo = new ConfiguracaoContabilXtpgRepository();
    private readonly contasRepo = new ContasBancariasDeParaRepository();
    private readonly contasContabeisRepo = new ContasContabeisDeParaRepository();
    private readonly createJournalEntry = new IntegracaoSapCreateJournalEntryService();

    async execute(): Promise<ResumoSaida> {
        const resumo: ResumoSaida = { totalMovimentos: 0, totalLotes: 0, lcmCriados: 0, erros: 0, erroListagem: null };

        const listagem = await this.soap.listarMovimentos(Config.XTPG_SAIDA_STATUS_BUSCA);
        if (listagem.erro) {
            resumo.erroListagem = listagem.erro;
            log.error(`[ProcessarSaidaXtpg] Falha ao listar movimentos: ${listagem.erro}`);
            return resumo;
        }

        resumo.totalMovimentos = listagem.movimentos.length;
        const pars = agruparPorParContabil(listagem.movimentos);
        resumo.totalLotes = pars.length;

        // DTZ-302: processamento LOTE-ATÔMICO — agrupa os PARs por LOTE e trata cada grupo
        // de forma atômica (cancela o lote inteiro se algum PAR falhar).
        const grupos = agruparPorLote(pars);
        for (const grupo of grupos) {
            try {
                await this.processarGrupoLote(grupo, resumo);
            } catch (error) {
                resumo.erros += 1;
                const msg = error instanceof Error ? error.message : String(error);
                log.error(`[ProcessarSaidaXtpg] Erro no lote ${grupo[0]?.lote ?? "?"}: ${msg}`);
            }
        }
        return resumo;
    }

    /**
     * (DTZ-302) Processa um grupo de PARs de um mesmo LOTE de forma atômica.
     * Fase 1: prepara (valida/monta/persiste) todos os PARs sem enviar.
     * Fase 2: se algum PAR falhou → cancela o lote (devolve erro a todos os pendentes);
     *         senão → comita cada PAR (envia o LCM e devolve o status), respeitando o gate.
     */
    private async processarGrupoLote(grupo: LoteParContabil[], resumo: ResumoSaida): Promise<void> {
        const preparos: PreparoPar[] = [];
        for (const par of grupo) preparos.push(await this.prepararPar(par));

        // PARs já integrados no S/4: apenas refazem a fila XTPG (nunca recriam o LCM).
        for (const prep of preparos) {
            if (prep.jaIntegrado && prep.headerId != null) {
                await this.reprocessarFilaXtpgPorId(prep.headerId, prep.lote);
            }
        }

        const pendentes = preparos.filter((p) => !p.jaIntegrado);
        if (pendentes.length === 0) return;

        const loteId = grupo[0]?.lote ?? "";
        const decisao = decidirCancelamentoLote(preparos);

        if (decisao.cancelar) {
            // Cancela o LOTE inteiro: devolve erro ao XTPG para TODOS os PARs pendentes,
            // inclusive os que passariam sozinhos (motivo: PAR irmão falhou).
            for (const prep of pendentes) {
                if (prep.headerId == null) continue;
                const critica = prep.descricaoErro
                    ? prep.descricaoErro
                    : `Lote ${loteId} cancelado: o PAR ${decisao.parComErro} falhou (${decisao.motivo}).`;
                if (!prep.descricaoErro) {
                    await s4DotzClient.xtpgSaidaHeader.update({
                        where: { id: prep.headerId },
                        data: { statusSap: "ERRO", descricaoSap: critica },
                    });
                }
                await this.devolverErroXtpg(prep.headerId, prep.lote, critica);
                resumo.erros += 1;
            }
            log.warn(
                `[ProcessarSaidaXtpg] Lote ${loteId} cancelado: ${pendentes.length} PAR(s) devolvido(s) ` +
                    `(motivo: PAR ${decisao.parComErro} - ${decisao.motivo}).`,
            );
            return;
        }

        // Todos válidos. Fila SAP só envia com o gate habilitado.
        if (!Config.XTPG_SAIDA_ENVIO_SAP_HABILITADO) {
            log.warn(
                `[ProcessarSaidaXtpg] Lote ${loteId}: envio ao S/4 DESABILITADO ` +
                    `(XTPG_SAIDA_ENVIO_SAP_HABILITADO=false). ${pendentes.length} LCM(s) montado(s), não enviado(s).`,
            );
            return;
        }

        // Fase 2a: integra TODOS os PARs no S/4 (fila SAP) — sem ainda tocar no XTPG.
        // Marco (26/08): o OK ao XTPG só sai depois que o lote inteiro foi processado, para não
        // OK-ar um PAR e o lote acabar cancelado por erro num PAR seguinte.
        const sapResults: ResultadoIntegracaoSap[] = [];
        for (const prep of pendentes) {
            if (prep.headerId == null || !prep.integracaoJson) {
                sapResults.push({ prep, sucesso: false, codigoSap: null, erro: "LCM não montado" });
                continue;
            }
            const r = await this.integrarLcmSap(prep.headerId, prep.integracaoJson);
            sapResults.push({ prep, ...r });
        }

        // Fase 2b: só agora decide. Se algum PAR falhou no S/4 → cancela o lote no XTPG (não
        // envia OK de nenhum). Senão → envia o OK de todos.
        const falhaSap = sapResults.find((r) => !r.sucesso);
        if (falhaSap) {
            const critica = `Lote ${loteId} cancelado: falha ao integrar no S/4 o PAR ${falhaSap.prep.lote.parContabil} (${falhaSap.erro}).`;
            // DTZ-302 (Marco 26/08): ESTORNA os LCMs já criados dos outros PARs do lote antes de
            // devolver o erro — atomicidade real, já que o /createJournalEntry é single-LCM (BTP)
            // e não há changeset atômico.
            const aEstornar = selecionarParaEstorno(sapResults);
            for (const r of aEstornar) {
                if (r.prep.headerId == null || !r.prep.integracaoJson || !r.codigoSap) continue;
                await this.estornarLcmSap(r.prep.headerId, r.prep.integracaoJson, r.codigoSap, loteId);
            }
            for (const r of sapResults) {
                if (r.prep.headerId == null) continue;
                await this.devolverErroXtpg(r.prep.headerId, r.prep.lote, critica);
                resumo.erros += 1;
            }
            log.warn(
                `[ProcessarSaidaXtpg] Lote ${loteId} cancelado na fila SAP: PAR ${falhaSap.prep.lote.parContabil} ` +
                    `falhou (${falhaSap.erro}). ${aEstornar.length} LCM(s) estornado(s), ${sapResults.length} PAR(s) devolvido(s), nenhum OK enviado.`,
            );
            return;
        }
        for (const r of sapResults) {
            if (r.prep.headerId == null) continue;
            await this.enviarOkXtpg(r.prep.headerId, r.prep.lote, r.codigoSap);
            resumo.lcmCriados += 1;
        }
    }

    /** Refaz a fila XTPG de um PAR já integrado (carrega o header e delega). DTZ-302. */
    private async reprocessarFilaXtpgPorId(headerId: number, lote: LoteParContabil): Promise<void> {
        const header = await s4DotzClient.xtpgSaidaHeader.findUnique({
            where: { id: headerId },
            select: { id: true, statusXtpg: true, codigoSap: true },
        });
        if (header) await this.reprocessarFilaXtpg(header, lote);
    }

    /**
     * (DTZ-302) Fase de PREPARO de um PAR: valida de-paras, monta o LCM e persiste
     * Header/Detail SEM enviar ao S/4 nem devolver status ao XTPG. O envio (ou o
     * cancelamento do lote) fica a cargo de `processarGrupoLote`, depois que todos os
     * PARs do mesmo LOTE foram preparados.
     */
    private async prepararPar(lote: LoteParContabil): Promise<PreparoPar> {
        const chaveValidacao = `${lote.pfjCodigo}-${lote.parContabil}`;

        // Idempotência (matriz de reprocessamento por statusSap): se o SAP já integrou,
        // nunca recria o LCM — o grupo apenas refaz a fila XTPG com o LCM existente.
        const existente = await s4DotzClient.xtpgSaidaHeader.findFirst({
            where: { chaveValidacao },
            orderBy: { id: "desc" },
        });
        if (existente?.statusSap === "INTEGRADO") {
            return { lote, headerId: existente.id, chaveValidacao, integracaoJson: null, descricaoErro: null, jaIntegrado: true };
        }

        // De-para de empresa: PFJ_CODIGO (numérico) == cia.cia_id_sap (DTZ-289).
        const cia = await this.ciaRepo.resolver(lote.pfjCodigo);

        // Configuração Contábil XTPG_R (tipoArApGl / tipoDocumento / textoDocumento).
        const configuracao = cia ? await this.configRepo.buscar(cia.ciaId) : null;

        // De-para de conta bancária por movimento. Sem correspondência => trava o
        // PAR_CONTABIL inteiro — mas SÓ para movimentos que usam conta banco (DTZ-295,
        // Marco 18/08). Movimentos sem banco (ex.: transferência de período) não têm banco
        // e portanto não exigem o de-para bancário.
        const houseBankPorMovimento = new Map<string, HouseBankRef | null>();
        const movimentosSemDePara: string[] = [];
        // De-para conta contábil B1 (XTPG) -> S/4 (contas_contabeis.gl_account_b1_xtpg).
        // Conta B1 não existe no plano YCOA do S/4 – sem conversão o S/4 rejeita (507(F5)).
        const contaS4PorContaB1 = new Map<string, string>();
        // DTZ-247: centro de custo/lucro por conta S/4 (cadastrados em contas_contabeis),
        // usados para preencher as linhas do LCM enviado ao S/4.
        const centrosPorContaS4 = new Map<string, { centroCusto: string | null; centroLucro: string | null }>();
        const contasSemDePara: string[] = [];
        if (cia) {
            for (const mov of lote.movimentos) {
                const usaBanco = mov.banCodigo.trim() !== "";
                const ref = usaBanco
                    ? await this.contasRepo.resolver({
                          codigoCia: cia.companyCode,
                          contaContabil: mov.contaContabil,
                          banCodigo: mov.banCodigo,
                          ageCodigo: mov.ageCodigo,
                          cntCodigo: mov.cntCodigo,
                      })
                    : null;
                houseBankPorMovimento.set(mov.mvtContador, ref);
                if (usaBanco && !ref) {
                    movimentosSemDePara.push(
                        `conta ${mov.contaContabil} / banco ${mov.banCodigo}-${mov.ageCodigo}-${mov.cntCodigo}`,
                    );
                }

                if (!contaS4PorContaB1.has(mov.contaContabil)) {
                    const dePara = await this.contasContabeisRepo.resolver({
                        companyCode: cia.companyCode,
                        contaB1: mov.contaContabil,
                    });
                    if (dePara) {
                        contaS4PorContaB1.set(mov.contaContabil, dePara.glAccount);
                        centrosPorContaS4.set(dePara.glAccount, {
                            centroCusto: dePara.centroCusto,
                            centroLucro: dePara.centroLucro,
                        });
                    } else if (!contasSemDePara.includes(mov.contaContabil)) {
                        contasSemDePara.push(mov.contaContabil);
                    }
                }
            }
        }
        const travadoPorDePara = movimentosSemDePara.length > 0 || contasSemDePara.length > 0;

        // Monta o LCM (formato do exemplo do dev: linhas agregadas por conta, header enxuto).
        let integracaoJson = cia && configuracao && !travadoPorDePara
            ? buildLcmFromMovimentos({
                  lote,
                  codigoCia: cia.companyCode,
                  configuracao,
                  contaS4PorContaB1,
                  centrosPorContaS4,
                  usuarioLancamento: Config.S4_HANA_CLOUD_USER_NAME || "",
              })
            : null;

        const errosDePara: string[] = [];
        if (movimentosSemDePara.length > 0) {
            errosDePara.push(`Conta bancária sem correspondência (contas_bancarias): ${movimentosSemDePara.join("; ")}`);
        }
        if (contasSemDePara.length > 0) {
            errosDePara.push(
                `Conta contábil B1 sem de-para S/4 (contas_contabeis.gl_account_b1_xtpg): ${contasSemDePara.join(", ")}`,
            );
        }
        let descricaoErro = !cia
            ? `Empresa não encontrada no de-para (cia) para PFJ_CODIGO ${lote.pfjCodigo}`
            : !configuracao
              ? `Configuração contábil XTPG_R não cadastrada para a CIA ${cia.ciaId} (${lote.pfjCodigo})`
              : travadoPorDePara
                ? `PAR_CONTABIL travado. ${errosDePara.join(" | ")}`
                : null;

        // Persiste Header + Detail (mesmo quando o envio está desabilitado). Reprocesso é
        // in-place: reusa o header da mesma chaveValidacao em vez de duplicar (DTZ-289).
        const dadosHeader = {
            ciaId: cia?.ciaId ?? null,
            ciaSap: lote.pfjCodigo,
            parContabil: lote.parContabil,
            chaveValidacao,
            totalRegistros: lote.movimentos.length,
            statusSap: descricaoErro ? "ERRO" : "AGUARDANDO",
            descricaoSap: descricaoErro,
            requestSap: integracaoJson ? JSON.stringify(integracaoJson) : null,
        };
        const detalhesCreate = lote.movimentos.map((mov) => {
            const hb = houseBankPorMovimento.get(mov.mvtContador) ?? null;
            return {
                mvtContador: mov.mvtContador,
                contaContabil: mov.contaContabil,
                contaContabilS4: contaS4PorContaB1.get(mov.contaContabil) ?? null,
                creditoDebito: mov.creditoDebito,
                valor: mov.valor,
                historico: mov.historico,
                indCodigo: mov.indCodigo,
                banCodigo: mov.banCodigo,
                ageCodigo: mov.ageCodigo,
                cntCodigo: mov.cntCodigo,
                houseBank: hb?.houseBank ?? null,
                houseBankAccount: hb?.houseBankAccount ?? null,
            };
        });

        // Aqui `existente` (se houver) tem statusSap != INTEGRADO — o INTEGRADO já retornou
        // acima — então sobrescrever a fila SAP é seguro e não recria LCM.
        let headerId: number;
        if (existente) {
            await s4DotzClient.xtpgSaidaDetail.deleteMany({ where: { headerId: existente.id } });
            const header = await s4DotzClient.xtpgSaidaHeader.update({
                where: { id: existente.id },
                data: { ...dadosHeader, detalhes: { create: detalhesCreate } },
            });
            headerId = header.id;
        } else {
            const header = await s4DotzClient.xtpgSaidaHeader.create({
                data: { ...dadosHeader, detalhes: { create: detalhesCreate } },
            });
            headerId = header.id;
        }

        // "Lançamento na mesma conta": quando débito e crédito de um PAR caem na mesma
        // conta S/4, a linha agregada zera e o S/4 rejeita com um HTTP 400 sem descrição
        // útil. Detecta ANTES de enviar (Marco 21/08, lote 040120260820171939) e marca ERRO;
        // a devolução ao XTPG acontece na fase de grupo (processarGrupoLote).
        if (integracaoJson) {
            const contasZeradas = detectarContasZeradas(integracaoJson.lancamentosContabeis);
            if (contasZeradas.length > 0) {
                const contas = [...new Set(contasZeradas)].join(", ");
                descricaoErro = `Débito e crédito na mesma conta contábil ${contas}: a linha zera e o S/4 rejeita o lançamento.`;
                integracaoJson = null;
                await s4DotzClient.xtpgSaidaHeader.update({
                    where: { id: headerId },
                    data: { statusSap: "ERRO", descricaoSap: descricaoErro },
                });
            }
        }

        return { lote, headerId, chaveValidacao, integracaoJson, descricaoErro, jaIntegrado: false };
    }

    /**
     * (Fase 2a — DTZ-302) Integra o LCM no S/4 (fila SAP). NÃO toca no XTPG: o OK ao XTPG só é
     * enviado depois que TODO o lote foi processado no S/4 (Marco 26/08), para não OK-ar um PAR
     * e o lote acabar cancelado por erro num PAR seguinte. Registra statusSap e devolve o resultado.
     */
    private async integrarLcmSap(
        headerId: number,
        integracaoJson: ReturnType<typeof buildLcmFromMovimentos>,
    ): Promise<{ sucesso: boolean; codigoSap: string | null; erro: string | null }> {
        try {
            const resp = await this.createJournalEntry.execute(integracaoJson);
            const codigoSap = this.extrairCodigoSap(resp?.data);
            await s4DotzClient.xtpgSaidaHeader.update({
                where: { id: headerId },
                data: {
                    statusSap: "INTEGRADO",
                    codigoSap,
                    dataIntegracaoSap: new Date(),
                    responseSap: JSON.stringify(resp?.data ?? null),
                },
            });
            return { sucesso: true, codigoSap, erro: null };
        } catch (error) {
            const extracted = extractSapIntegrationAxiosError(error);
            const erro = `HTTP ${extracted.httpStatus}: ${extracted.mensagem}`;
            await s4DotzClient.xtpgSaidaHeader.update({
                where: { id: headerId },
                data: {
                    statusSap: "ERRO",
                    descricaoSap: erro,
                    responseSap: extracted.corpo != null ? JSON.stringify(extracted.corpo) : null,
                },
            });
            return { sucesso: false, codigoSap: null, erro };
        }
    }

    /** (Fase 2b — DTZ-302) Envia o OK (MudarStatus C) ao XTPG para um PAR já integrado no S/4. */
    private async enviarOkXtpg(headerId: number, lote: LoteParContabil, codigoSap: string | null): Promise<void> {
        const resultado = await this.soap.mudarStatusParContabil({
            parContabil: lote.parContabil,
            status: Config.XTPG_SAIDA_STATUS_SUCESSO,
            critica: codigoSap ?? "",
        });
        await s4DotzClient.xtpgSaidaHeader.update({
            where: { id: headerId },
            data: {
                statusXtpg: resultado.sucesso ? "INTEGRADO" : "ERRO",
                descricaoXtpg: resultado.mensagem,
                dataIntegracaoXtpg: new Date(),
                requestXtpg: resultado.requestXml,
                responseXtpg: resultado.responseXml,
                criticaXtpg: codigoSap ?? "",
            },
        });
    }

    /**
     * (DTZ-302, Marco 26/08) Estorna um LCM já criado no S/4 quando o lote é cancelado por falha
     * em outro PAR. Reutiliza o próprio `createJournalEntry` com os valores INVERTIDOS (o sinal já
     * codifica D/C, então estornar = `valor * -1`) — lançamento compensador que zera o efeito do
     * original, sem depender de um endpoint de reversão do BTP. Prefixo "EST " no texto do header
     * (limite de 25 caracteres no S/4). Best-effort: se falhar, o LCM permanece no S/4 e o erro é
     * registrado (requer atenção manual).
     *
     * Obs.: é um lançamento COMPENSADOR (sinais opostos), não um estorno formal (tipo FB08) que
     * marca o original como revertido. Nets o valor a zero; se auditoria exigir o vínculo formal,
     * aí sim precisaria do endpoint de reversão.
     */
    private async estornarLcmSap(
        headerId: number,
        integracaoJson: ReturnType<typeof buildLcmFromMovimentos>,
        codigoSap: string,
        loteId: string,
    ): Promise<void> {
        // Vínculo com o original: o texto do header do compensador referencia o nº do LCM
        // estornado ("XTPG EST {codigoSap}"), com a mesma marca de saída do original — a view
        // filtra 'XTPG %' e ignora o par original/compensador (§3.6). Limite de 25 chars no S/4.
        const estornoJson = {
            ...integracaoJson,
            textoDocumento: marcarTextoSaida(`EST ${codigoSap}`),
            lancamentosContabeis: integracaoJson.lancamentosContabeis.map((l) => ({ ...l, valor: -l.valor })),
        };
        try {
            const resp = await this.createJournalEntry.execute(estornoJson);
            const estornoSap = this.extrairCodigoSap(resp?.data);
            await s4DotzClient.xtpgSaidaHeader.update({
                where: { id: headerId },
                data: {
                    statusSap: "ESTORNADO",
                    descricaoSap: `LCM ${codigoSap} estornado pelo LCM ${estornoSap ?? "?"} (lote ${loteId} cancelado).`,
                    responseSap: JSON.stringify(resp?.data ?? null),
                },
            });
        } catch (error) {
            const extracted = extractSapIntegrationAxiosError(error);
            const msg = `FALHA AO ESTORNAR LCM ${codigoSap} (lote ${loteId}): HTTP ${extracted.httpStatus}: ${extracted.mensagem} — LCM permanece no S/4, requer atencao manual.`;
            log.error(`[ProcessarSaidaXtpg] ${msg}`);
            await s4DotzClient.xtpgSaidaHeader.update({
                where: { id: headerId },
                data: { descricaoSap: msg },
            });
        }
    }

    /**
     * Reprocessa SOMENTE a fila XTPG de um PAR_CONTABIL cujo LCM já foi integrado no S/4
     * (statusSap = INTEGRADO): usa o `codigo_sap` já gravado e nunca recria o LCM (DTZ-289).
     */
    private async reprocessarFilaXtpg(
        header: { id: number; statusXtpg: string; codigoSap: string | null },
        lote: LoteParContabil,
    ): Promise<boolean> {
        if (header.statusXtpg === "INTEGRADO") return false; // nada a fazer
        if (!Config.XTPG_SAIDA_ENVIO_SAP_HABILITADO) return false;

        const codigoSap = header.codigoSap ?? "";
        const resultado = await this.soap.mudarStatusParContabil({
            parContabil: lote.parContabil,
            status: Config.XTPG_SAIDA_STATUS_SUCESSO,
            critica: codigoSap,
        });
        await s4DotzClient.xtpgSaidaHeader.update({
            where: { id: header.id },
            data: {
                statusXtpg: resultado.sucesso ? "INTEGRADO" : "ERRO",
                descricaoXtpg: resultado.mensagem,
                dataIntegracaoXtpg: new Date(),
                requestXtpg: resultado.requestXml,
                responseXtpg: resultado.responseXml,
                criticaXtpg: codigoSap,
            },
        });
        return resultado.sucesso;
    }

    /**
     * Devolve ERRO ao XTPG (status E, crítica = motivo) para qualquer ramo de erro tratado em
     * `processarGrupoLote` – de-para/empresa/config faltando, mesma conta, cancelamento do lote
     * ou erro no S/4. Sem isso o PAR fica preso em "aguardando" e o time do XTPG não vê por que
     * não carregou (Marco 20/08). Sem gate: vale inclusive para PAR pendente por mapeamento incompleto.
     */
    private async devolverErroXtpg(headerId: number, lote: LoteParContabil, critica: string): Promise<void> {
        // A crítica é um campo curto no legado; trunca a mensagem para não estourar/dar fault.
        const criticaTruncada = (critica || "Erro de integração").slice(0, 250);
        const resultado = await this.soap.mudarStatusParContabil({
            parContabil: lote.parContabil,
            status: Config.XTPG_SAIDA_STATUS_ERRO,
            critica: criticaTruncada,
        });
        await s4DotzClient.xtpgSaidaHeader.update({
            where: { id: headerId },
            data: {
                statusXtpg: resultado.sucesso ? "ERRO_DEVOLVIDO" : "ERRO",
                descricaoXtpg: resultado.sucesso ? criticaTruncada : resultado.mensagem,
                dataIntegracaoXtpg: new Date(),
                requestXtpg: resultado.requestXml,
                responseXtpg: resultado.responseXml,
                criticaXtpg: criticaTruncada,
            },
        });
    }

    /**
     * Extrai o nº do LCM da resposta do createJournalEntry.
     * Formato confirmado em homolog (12/06): { numeroDocumentoERP: "0100000039",
     * mensagem: "Documento criado com sucesso", ... }.
     */
    private extrairCodigoSap(data: unknown): string | null {
        if (!data || typeof data !== "object") return null;
        const obj = data as Record<string, unknown>;
        const candidato =
            obj.numeroDocumentoERP ?? obj.codigoSap ?? obj.AccountingDocument ?? obj.numeroDocumento ?? null;
        return candidato != null ? String(candidato) : null;
    }
}
