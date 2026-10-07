/** Carrega o status_para_envio atual de registros_contabeis a partir das chaves dos DETAILs. */
import s4DotzClient from "@/database/clients/s4DotzClient";
import { parseChaveRegistro } from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";

/** Mapa chave ("Company-fiscal-doc-item") -> status_para_envio ('S'|'E'|'P'|null). */
export async function loadRegistroStatusByChaves(
    chaves: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    const pks = chaves
        .map((ch) => ({ ch, pk: parseChaveRegistro(ch) }))
        .filter((x): x is { ch: string; pk: NonNullable<ReturnType<typeof parseChaveRegistro>> } => Boolean(x.pk));

    if (pks.length === 0) return map;

    const rows = await s4DotzClient.accountingDocumentItem.findMany({
        where: {
            OR: pks.map((p) => ({
                AND: [
                    { CompanyCode: p.pk.CompanyCode },
                    { FiscalYear: p.pk.FiscalYear },
                    { AccountingDocument: p.pk.AccountingDocument },
                    { AccountingDocumentItem: p.pk.AccountingDocumentItem },
                ],
            })),
        },
        select: {
            CompanyCode: true,
            FiscalYear: true,
            AccountingDocument: true,
            AccountingDocumentItem: true,
            StatusParaEnvio: true,
        },
    });

    for (const r of rows) {
        const key = `${r.CompanyCode}-${r.FiscalYear}-${r.AccountingDocument}-${r.AccountingDocumentItem}`;
        map.set(key, r.StatusParaEnvio);
    }
    return map;
}

/** Resolve os delegates Prisma das tabelas de log por fluxo. */
export function getLogDelegates(fluxo: "PREVISTO" | "REALIZADO") {
    if (fluxo === "PREVISTO") {
        return { header: s4DotzClient.xtpgEnvioPrevistoHeader, detail: s4DotzClient.xtpgEnvioPrevistoDetail };
    }
    return { header: s4DotzClient.xtpgEnvioRealizadoHeader, detail: s4DotzClient.xtpgEnvioRealizadoDetail };
}
