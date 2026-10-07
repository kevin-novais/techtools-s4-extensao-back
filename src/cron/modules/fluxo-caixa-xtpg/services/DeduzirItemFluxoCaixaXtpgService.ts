import type { AccountingDocumentItem, ContasContabeis } from "@prisma/client-s4-dotz";
import { Decimal } from "@prisma/client/runtime/library";
import s4DotzClient from "@/database/clients/s4DotzClient";
import { Config } from "@/config/config";
import log from "@/util/logger";
import { normalizeXtpgCompanyCode } from "@/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize";
import {
    buildXtpgTipoLancamentoKeyFromRegistro,
    xtpgTipoLancamentoKeyToString,
    type XtpgTipoLancamentoKeyNormalized,
} from "@/cron/modules/fluxo-caixa-xtpg/utils/buildXtpgTipoLancamentoKeyFromRegistro";
import {
    ITEM_FLUXO_XTPG_RESERVADOS,
    isValidClassifiedItemFluxoXtpg,
    normalizeItemFluxoXtpgValue,
    normalizeSapDocReference,
} from "@/cron/modules/fluxo-caixa-xtpg/utils/itemFluxoCaixaXtpgNormalize";

export type DeduzirItemFluxoCaixaXtpgResult = {
    processed: number;
    classified: number;
    errorsSet: number;
    skippedAlreadyValid: number;
};

type ContaLookup = {
    byChartKey: Map<string, ContasContabeis>;
    fallbackByCoGl: Map<string, ContasContabeis>;
};

type DeduceContext = {
    linesByDoc: Map<string, AccountingDocumentItem[]>;
    contaLookup: ContaLookup;
    reverseByKey: Map<string, AccountingDocumentItem>;
    clearingByKey: Map<string, AccountingDocumentItem>;
    tddByKey: Map<string, string>;
    partnerByCardCompany: Map<string, string>;
};

type AccountingDocumentRegistroKey = Pick<
    AccountingDocumentItem,
    "CompanyCode" | "FiscalYear" | "AccountingDocument" | "AccountingDocumentItem"
>;

type AccountingDocumentDocKey = Pick<
    AccountingDocumentItem,
    "CompanyCode" | "FiscalYear" | "AccountingDocument"
>;

type RegistroPk = ReturnType<typeof registroPk>;

type DeduceOneResolved = { kind: "item"; item: string } | { kind: "error"; erro: string };

const ERRO_GENERICO =
    "Não foi possível classificar item de fluxo de caixa (XTPG) com as regras vigentes.";
const ERRO_CONTA_INELEGIVEL =
    "Conta contábil não elegível para classificação XTPG (plano inexistente ou XTPG não ativo).";
const MAX_ERRO_LEN = 500;

function registroPk(line: AccountingDocumentItem) {
    return {
        CompanyCode: line.CompanyCode,
        FiscalYear: line.FiscalYear,
        AccountingDocument: line.AccountingDocument,
        AccountingDocumentItem: line.AccountingDocumentItem,
    };
}

function registroKey(line: AccountingDocumentRegistroKey) {
    return `${line.CompanyCode}|${line.FiscalYear}|${line.AccountingDocument}|${line.AccountingDocumentItem}`;
}

function docGroupKey(line: AccountingDocumentDocKey) {
    return `${line.CompanyCode.trim()}|${line.FiscalYear.trim()}|${line.AccountingDocument.trim()}`;
}

function decimalSign(amount: Decimal | null | undefined): number {
    if (amount == null) return 0;
    const n = amount.toNumber();
    if (n === 0) return 0;
    return n > 0 ? 1 : -1;
}

function absAmountCompare(a: Decimal | null | undefined, b: Decimal | null | undefined): number {
    const na = Math.abs(a?.toNumber() ?? 0);
    const nb = Math.abs(b?.toNumber() ?? 0);
    return nb - na;
}

function contaChartKey(chart: string, company: string, gl: string): string {
    return `${chart.trim()}|${company.trim()}|${gl.trim()}`;
}

function contaFallbackKey(company: string, gl: string): string {
    return `${company.trim()}|${gl.trim()}`;
}

function lookupContaForLine(line: AccountingDocumentItem, lookup: ContaLookup): ContasContabeis | null {
    const co = line.CompanyCode.trim();
    const gl = (line.GLAccount ?? "").trim();
    if (!gl) return null;

    const chart = line.ChartOfAccounts?.trim() ?? null;
    if (chart) {
        const direct = lookup.byChartKey.get(contaChartKey(chart, co, gl));
        if (direct) return direct;
    }

    return lookup.fallbackByCoGl.get(contaFallbackKey(co, gl)) ?? null;
}

function truncateErro(msg: string): string {
    if (msg.length <= MAX_ERRO_LEN) return msg;
    return msg.slice(0, MAX_ERRO_LEN);
}

export class DeduzirItemFluxoCaixaXtpgService {
    async execute(params?: { limit?: number }): Promise<DeduzirItemFluxoCaixaXtpgResult> {
        const limit = params?.limit ?? Config.CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE;
        const reabertas = await this.reabrirLinhasComCadastroAtualizado();
        if (reabertas > 0) {
            log.info(`[DeduzirItemFluxoCaixaXtpgService] ${reabertas} linha(s) reabertas por alteração no cadastro de contas.`);
        }
        const candidates = await this.fetchCandidates(limit);

        if (candidates.length === 0) {
            return {
                processed: 0,
                classified: 0,
                errorsSet: 0,
                skippedAlreadyValid: 0,
            };
        }

        let skippedAlreadyValid = 0;
        const toProcess: AccountingDocumentItem[] = [];
        for (const line of candidates) {
            if (isValidClassifiedItemFluxoXtpg(line.ItemFluxodeCaixa)) {
                skippedAlreadyValid += 1;
                continue;
            }
            toProcess.push(line);
        }

        if (toProcess.length === 0) {
            return {
                processed: candidates.length,
                classified: 0,
                errorsSet: 0,
                skippedAlreadyValid,
            };
        }

        const docKeys = this.uniqueDocKeys(toProcess);
        const siblings = await this.fetchLinesForDocuments(docKeys);
        const linesByDoc = this.groupLinesByDoc(siblings);

        const contaLookup = await this.buildContaLookup(siblings);
        const { reverseByKey, clearingByKey } = await this.prefetchReverseAndClearing(toProcess);
        const tddByKey = await this.prefetchTddMap(toProcess);
        const partnerByCardCompany = await this.prefetchPartnerMap(toProcess);

        const ctx: DeduceContext = {
            linesByDoc,
            contaLookup,
            reverseByKey,
            clearingByKey,
            tddByKey,
            partnerByCardCompany,
        };

        const updatesSuccess: Array<{ pk: ReturnType<typeof registroPk>; item: string }> = [];
        const updatesError: Array<{ pk: ReturnType<typeof registroPk>; erro: string }> = [];

        for (const line of toProcess) {
            const resolved = this.deduceOne(line, ctx);
            if (resolved.kind === "item") {
                updatesSuccess.push({ pk: registroPk(line), item: resolved.item });
                continue;
            }
            updatesError.push({ pk: registroPk(line), erro: resolved.erro });
        }

        if (updatesSuccess.length > 0) {
            await s4DotzClient.$transaction(
                updatesSuccess.map((u) =>
                    s4DotzClient.accountingDocumentItem.update({
                        where: {
                            CompanyCode_FiscalYear_AccountingDocument_AccountingDocumentItem: u.pk,
                        },
                        data: {
                            ItemFluxodeCaixa: u.item,
                            XtpgClassificacaoErro: null,
                            XtpgClassificacaoErroEm: null,
                        },
                    }),
                ),
            );
        }

        if (updatesError.length > 0) {
            await s4DotzClient.$transaction(
                updatesError.map((u) =>
                    s4DotzClient.accountingDocumentItem.update({
                        where: {
                            CompanyCode_FiscalYear_AccountingDocument_AccountingDocumentItem: u.pk,
                        },
                        data: {
                            XtpgClassificacaoErro: truncateErro(u.erro),
                            XtpgClassificacaoErroEm: new Date(),
                        },
                    }),
                ),
            );
        }

        log.info(
            `[DeduzirItemFluxoCaixaXtpgService] batch: candidatos=${candidates.length} processadas=${toProcess.length} classificadas=${updatesSuccess.length} erros=${updatesError.length} já_válidas=${skippedAlreadyValid}`,
        );

        return {
            processed: candidates.length,
            classified: updatesSuccess.length,
            errorsSet: updatesError.length,
            skippedAlreadyValid,
        };
    }

    /// Linha que ja falhou so volta a ser candidata quando o cadastro da sua conta muda:
    /// a causa da falha e sempre cadastro, entao reprocessar antes disso apenas repete o
    /// mesmo erro. Sem isso o cron reprocessa indefinidamente o mesmo conjunto a cada
    /// ciclo (medido: 2194 candidatos, 1945 erros, todos reincidentes) e chega a provocar
    /// deadlock com a sync.
    private async reabrirLinhasComCadastroAtualizado(): Promise<number> {
        return s4DotzClient.$executeRaw`
            UPDATE rc
               SET rc.xtpg_classificacao_erro = NULL,
                   rc.xtpg_classificacao_erro_em = NULL
              FROM dbo.registros_contabeis rc
             WHERE rc.xtpg_classificacao_erro_em IS NOT NULL
               AND EXISTS (
                     SELECT 1
                       FROM dbo.contas_contabeis cc
                      WHERE cc.company_code = rc.company_code
                        AND cc.gl_account = rc.gl_account
                        AND cc.data_alteracao > rc.xtpg_classificacao_erro_em
                   )`;
    }

    private async fetchCandidates(take: number): Promise<AccountingDocumentItem[]> {
        return s4DotzClient.accountingDocumentItem.findMany({
            where: {
                XtpgClassificacaoErro: null,
                OR: [
                    { ItemFluxodeCaixa: null },
                    ...ITEM_FLUXO_XTPG_RESERVADOS.map((reservado) => ({ ItemFluxodeCaixa: reservado })),
                ],
            },
            take,
            orderBy: [{ PostingDate: "desc" }, { CompanyCode: "asc" }],
        });
    }

    private uniqueDocKeys(lines: AccountingDocumentItem[]): AccountingDocumentDocKey[] {
        const seen = new Set<string>();
        const out: AccountingDocumentDocKey[] = [];
        for (const line of lines) {
            const k = docGroupKey(line);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push({
                CompanyCode: line.CompanyCode,
                FiscalYear: line.FiscalYear,
                AccountingDocument: line.AccountingDocument,
            });
        }
        return out;
    }

    private async fetchLinesForDocuments(docKeys: AccountingDocumentDocKey[]): Promise<AccountingDocumentItem[]> {
        if (docKeys.length === 0) return [];

        return s4DotzClient.accountingDocumentItem.findMany({
            where: {
                OR: docKeys.map((k) => ({
                    AND: [
                        { CompanyCode: k.CompanyCode },
                        { FiscalYear: k.FiscalYear },
                        { AccountingDocument: k.AccountingDocument },
                    ],
                })),
            },
        });
    }

    private groupLinesByDoc(lines: AccountingDocumentItem[]): Map<string, AccountingDocumentItem[]> {
        const map = new Map<string, AccountingDocumentItem[]>();
        for (const line of lines) {
            const k = docGroupKey(line);
            const arr = map.get(k);
            if (arr) {
                arr.push(line);
                continue;
            }
            map.set(k, [line]);
        }
        return map;
    }

    private async buildContaLookup(lines: AccountingDocumentItem[]): Promise<ContaLookup> {
        const chartTriples = new Map<string, { chart: string; company: string; gl: string }>();
        const coGl = new Set<string>();

        for (const line of lines) {
            const co = line.CompanyCode.trim();
            const gl = (line.GLAccount ?? "").trim();
            if (!gl) continue;

            coGl.add(contaFallbackKey(co, gl));
            const chart = line.ChartOfAccounts?.trim();
            if (chart) {
                const ck = contaChartKey(chart, co, gl);
                chartTriples.set(ck, { chart, company: co, gl });
            }
        }

        const byChartKey = new Map<string, ContasContabeis>();
        const fallbackByCoGl = new Map<string, ContasContabeis>();

        if (chartTriples.size > 0) {
            const rowsChart = await s4DotzClient.contasContabeis.findMany({
                where: {
                    XtpgAtivado: true,
                    OR: [...chartTriples.values()].map((t) => ({
                        AND: [
                            { ChartOfAccounts: t.chart },
                            { CompanyCode: t.company },
                            { GLAccount: t.gl },
                        ],
                    })),
                },
            });
            for (const row of rowsChart) {
                byChartKey.set(contaChartKey(row.ChartOfAccounts, row.CompanyCode, row.GLAccount), row);
            }
        }

        if (coGl.size > 0) {
            const parts = [...coGl].map((p) => {
                const [company, gl] = p.split("|");
                return { company, gl };
            });
            const rowsFb = await s4DotzClient.contasContabeis.findMany({
                where: {
                    XtpgAtivado: true,
                    OR: parts.map((p) => ({
                        AND: [{ CompanyCode: p.company }, { GLAccount: p.gl }],
                    })),
                },
            });
            for (const row of rowsFb) {
                const fk = contaFallbackKey(row.CompanyCode, row.GLAccount);
                if (!fallbackByCoGl.has(fk)) {
                    fallbackByCoGl.set(fk, row);
                }
            }
        }

        return { byChartKey, fallbackByCoGl };
    }

    private collectReverseAndClearingPks(lines: AccountingDocumentItem[]): {
        reversePks: RegistroPk[];
        clearingPks: RegistroPk[];
    } {
        const reversePks: RegistroPk[] = [];
        const clearingPks: RegistroPk[] = [];

        for (const line of lines) {
            const revDoc = normalizeSapDocReference(line.ReverseDocument);
            const revFy = normalizeSapDocReference(line.ReverseDocumentFiscalYear);
            if (revDoc && revFy) {
                reversePks.push({
                    CompanyCode: line.CompanyCode,
                    FiscalYear: revFy,
                    AccountingDocument: revDoc,
                    AccountingDocumentItem: line.AccountingDocumentItem,
                });
            }

            if (line.IsCleared !== "X") continue;

            const cFy = normalizeSapDocReference(line.ClearingDocFiscalYear);
            const cDoc = normalizeSapDocReference(line.ClearingAccountingDocument);
            const cItem = normalizeSapDocReference(line.ClearingItem);
            if (!cFy || !cDoc || !cItem) continue;

            clearingPks.push({
                CompanyCode: line.CompanyCode,
                FiscalYear: cFy,
                AccountingDocument: cDoc,
                AccountingDocumentItem: cItem,
            });
        }

        return { reversePks, clearingPks };
    }

    private uniqueRegistroPks(pks: RegistroPk[]): RegistroPk[] {
        const seen = new Set<string>();
        const out: RegistroPk[] = [];
        for (const pk of pks) {
            const k = registroKey(pk);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(pk);
        }
        return out;
    }

    private async loadAccountingItemsByPks(pks: RegistroPk[]): Promise<AccountingDocumentItem[]> {
        if (pks.length === 0) return [];

        return s4DotzClient.accountingDocumentItem.findMany({
            where: {
                OR: pks.map((pk) => ({
                    AND: [
                        { CompanyCode: pk.CompanyCode },
                        { FiscalYear: pk.FiscalYear },
                        { AccountingDocument: pk.AccountingDocument },
                        { AccountingDocumentItem: pk.AccountingDocumentItem },
                    ],
                })),
            },
        });
    }

    private async prefetchReverseAndClearing(lines: AccountingDocumentItem[]): Promise<{
        reverseByKey: Map<string, AccountingDocumentItem>;
        clearingByKey: Map<string, AccountingDocumentItem>;
    }> {
        const { reversePks, clearingPks } = this.collectReverseAndClearingPks(lines);
        const reverseByKey = new Map<string, AccountingDocumentItem>();
        const clearingByKey = new Map<string, AccountingDocumentItem>();

        const revRows = await this.loadAccountingItemsByPks(this.uniqueRegistroPks(reversePks));
        for (const row of revRows) {
            reverseByKey.set(registroKey(row), row);
        }

        const clrRows = await this.loadAccountingItemsByPks(this.uniqueRegistroPks(clearingPks));
        for (const row of clrRows) {
            clearingByKey.set(registroKey(row), row);
        }

        return { reverseByKey, clearingByKey };
    }

    private collectTddKeys(lines: AccountingDocumentItem[]): XtpgTipoLancamentoKeyNormalized[] {
        const seen = new Set<string>();
        const out: XtpgTipoLancamentoKeyNormalized[] = [];
        for (const line of lines) {
            const k = buildXtpgTipoLancamentoKeyFromRegistro(line);
            if (!k) continue;
            const sk = xtpgTipoLancamentoKeyToString(k);
            if (seen.has(sk)) continue;
            seen.add(sk);
            out.push(k);
        }
        return out;
    }

    private async prefetchTddMap(lines: AccountingDocumentItem[]): Promise<Map<string, string>> {
        const keys = this.collectTddKeys(lines);
        const map = new Map<string, string>();
        if (keys.length === 0) return map;

        const rows = await s4DotzClient.fluxoCaixaCiaTipoLancamento.findMany({
            where: {
                OR: keys.map((k) => ({
                    AND: [
                        { companyCode: k.companyCode },
                        { postingKey: k.postingKey },
                        { documentType: k.documentType },
                        { referenceDocumentType: k.referenceDocumentType },
                        { isReversed: k.isReversed },
                        { reversalReason: k.reversalReason },
                        { debitCreditCode: k.debitCreditCode },
                    ],
                })),
            },
        });

        for (const row of rows) {
            const k: XtpgTipoLancamentoKeyNormalized = {
                companyCode: row.companyCode,
                postingKey: row.postingKey,
                documentType: row.documentType,
                referenceDocumentType: row.referenceDocumentType,
                isReversed: row.isReversed,
                reversalReason: row.reversalReason,
                debitCreditCode: row.debitCreditCode,
            };
            map.set(xtpgTipoLancamentoKeyToString(k), row.itemFluxoCaixa);
        }

        return map;
    }

    private async prefetchPartnerMap(lines: AccountingDocumentItem[]): Promise<Map<string, string>> {
        const cards = new Set<string>();
        for (const line of lines) {
            const c = (line.Supplier ?? "").trim() || (line.Customer ?? "").trim();
            if (c) cards.add(c);
        }

        const map = new Map<string, string>();
        if (cards.size === 0) return map;

        const rows = await s4DotzClient.fluxoCaixaCiaParceiro.findMany({
            where: { cardCode: { in: [...cards] } },
        });

        for (const row of rows) {
            const company = normalizeXtpgCompanyCode(row.companyCode);
            map.set(`${row.cardCode}|${company}`, row.itemFluxoCaixa);
        }

        return map;
    }

    private tryDeduceFromReverseLine(line: AccountingDocumentItem, ctx: DeduceContext): string | null {
        const revDoc = normalizeSapDocReference(line.ReverseDocument);
        const revFy = normalizeSapDocReference(line.ReverseDocumentFiscalYear);
        if (!revDoc || !revFy) return null;

        const rk = registroKey({
            CompanyCode: line.CompanyCode,
            FiscalYear: revFy,
            AccountingDocument: revDoc,
            AccountingDocumentItem: line.AccountingDocumentItem,
        });
        const original = ctx.reverseByKey.get(rk);
        const fromRev = normalizeItemFluxoXtpgValue(original?.ItemFluxodeCaixa ?? "");
        if (!isValidClassifiedItemFluxoXtpg(fromRev)) return null;

        return fromRev;
    }

    private tryDeduceFromClearingLine(line: AccountingDocumentItem, ctx: DeduceContext): string | null {
        if (line.IsCleared !== "X") return null;

        const cFy = normalizeSapDocReference(line.ClearingDocFiscalYear);
        const cDoc = normalizeSapDocReference(line.ClearingAccountingDocument);
        const cItem = normalizeSapDocReference(line.ClearingItem);
        if (!cFy || !cDoc || !cItem) return null;

        const ck = registroKey({
            CompanyCode: line.CompanyCode,
            FiscalYear: cFy,
            AccountingDocument: cDoc,
            AccountingDocumentItem: cItem,
        });
        const pago = ctx.clearingByKey.get(ck);
        const fromClr = normalizeItemFluxoXtpgValue(pago?.ItemFluxodeCaixa ?? "");
        if (!isValidClassifiedItemFluxoXtpg(fromClr)) return null;

        return fromClr;
    }

    private tryDeduceFromTipoLancamentoLine(line: AccountingDocumentItem, ctx: DeduceContext): string | null {
        const tddKey = buildXtpgTipoLancamentoKeyFromRegistro(line);
        if (!tddKey) return null;

        const hit = ctx.tddByKey.get(xtpgTipoLancamentoKeyToString(tddKey));
        const fromTdd = normalizeItemFluxoXtpgValue(hit ?? "");
        if (!isValidClassifiedItemFluxoXtpg(fromTdd)) return null;

        return fromTdd;
    }

    private deduceOne(line: AccountingDocumentItem, ctx: DeduceContext): DeduceOneResolved {
        const conta = lookupContaForLine(line, ctx.contaLookup);
        if (conta?.XtpgAtivado !== true) {
            return { kind: "error", erro: ERRO_CONTA_INELEGIVEL };
        }

        const defaultItem = normalizeItemFluxoXtpgValue(conta.ItemFluxoDeCaixa);
        if (isValidClassifiedItemFluxoXtpg(defaultItem)) {
            return { kind: "item", item: defaultItem };
        }

        const fromRev = this.tryDeduceFromReverseLine(line, ctx);
        if (fromRev) {
            return { kind: "item", item: fromRev };
        }

        const fromClr = this.tryDeduceFromClearingLine(line, ctx);
        if (fromClr) {
            return { kind: "item", item: fromClr };
        }

        const fromCpl = this.deduceFromCounterparty(line, ctx);
        if (fromCpl) {
            return { kind: "item", item: fromCpl };
        }

        const fromTdd = this.tryDeduceFromTipoLancamentoLine(line, ctx);
        if (fromTdd) {
            return { kind: "item", item: fromTdd };
        }

        const fromPartner = this.deduceFromPartner(line, ctx.partnerByCardCompany);
        if (fromPartner) {
            return { kind: "item", item: fromPartner };
        }

        return { kind: "error", erro: ERRO_GENERICO };
    }

    private deduceFromCounterparty(line: AccountingDocumentItem, ctx: DeduceContext): string | null {
        const sibs = ctx.linesByDoc.get(docGroupKey(line)) ?? [];
        const baseSign = decimalSign(line.AmountInBalanceTransacCrcy);
        if (baseSign === 0) return null;

        const cpls = sibs
            .filter((s) => {
                if (registroKey(s) === registroKey(line)) return false;
                const sSign = decimalSign(s.AmountInBalanceTransacCrcy);
                if (sSign === 0) return false;
                return sSign !== baseSign;
            })
            .sort((a, b) => absAmountCompare(a.AmountInBalanceTransacCrcy, b.AmountInBalanceTransacCrcy));

        for (const cpl of cpls) {
            const cplConta = lookupContaForLine(cpl, ctx.contaLookup);
            if (!cplConta) continue;
            const it = normalizeItemFluxoXtpgValue(cplConta.ItemFluxoDeCaixa);
            if (isValidClassifiedItemFluxoXtpg(it)) return it;
        }

        return null;
    }

    private deduceFromPartner(line: AccountingDocumentItem, partnerMap: Map<string, string>): string | null {
        const card = (line.Supplier ?? "").trim() || (line.Customer ?? "").trim();
        if (!card) return null;

        const co = normalizeXtpgCompanyCode(line.CompanyCode);
        const exact = partnerMap.get(`${card}|${co}`);
        const wild = partnerMap.get(`${card}|`);

        const hit = exact ?? wild;
        const v = normalizeItemFluxoXtpgValue(hit ?? "");
        if (!isValidClassifiedItemFluxoXtpg(v)) return null;
        return v;
    }
}
