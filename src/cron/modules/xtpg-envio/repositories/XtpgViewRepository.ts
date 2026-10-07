/**
 * Leitura das views de origem do XTPG (XRT_SendPrevisto / XRT_SendRealizado).
 *
 * As views já filtram o que falta enviar (anti-duplicidade na própria view), então
 * apenas selecionamos as linhas. A fonte (stage / s4) e o nome da view são
 * configuráveis via .env (confirmar quando o SQL voltar).
 */
import DatabaseManager from "@/database/DatabaseManager";
import { Config } from "@/config/config";
import type { XtpgViewRow } from "@/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg";

type RawClient = { $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown> };

function getClient(): RawClient {
    if (Config.XTPG_VIEW_DATASOURCE === "s4") {
        return DatabaseManager.getS4DotzClient();
    }
    return DatabaseManager.getDotzStageClient();
}

/** Valida o nome da view (apenas identificadores SQL simples) para evitar injeção. */
function assertViewNameSeguro(viewName: string): void {
    if (!/^[A-Za-z0-9_.\[\]]+$/.test(viewName)) {
        throw new Error(`Nome de view XTPG inválido: "${viewName}"`);
    }
}

export class XtpgViewRepository {
    /** Lê as linhas da view de PREVISTO. */
    async lerPrevisto(maxPerRun: number): Promise<XtpgViewRow[]> {
        return this.lerView(Config.XTPG_VIEW_PREVISTO, maxPerRun);
    }

    /** Lê as linhas da view de REALIZADO. */
    async lerRealizado(maxPerRun: number): Promise<XtpgViewRow[]> {
        return this.lerView(Config.XTPG_VIEW_REALIZADO, maxPerRun);
    }

    private async lerView(viewName: string, maxPerRun: number): Promise<XtpgViewRow[]> {
        assertViewNameSeguro(viewName);

        const top = maxPerRun > 0 ? `TOP (${Math.floor(maxPerRun)}) ` : "";
        const query = `SELECT ${top}* FROM ${viewName}`;

        const rows = (await getClient().$queryRawUnsafe(query)) as XtpgViewRow[];
        return Array.isArray(rows) ? rows : [];
    }
}
