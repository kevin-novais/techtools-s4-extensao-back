/**
 * Busca a Configuração Contábil do processo VEX (Vexpense) para a CIA.
 * Header (ciaId, tipoProcesso='VEX'):
 *   - tipoContabilERP     -> tipoArApGl   (ex.: AP)
 *   - tipoDocumentoERP    -> tipoDocumento (ex.: DR)
 *   - textoHeaderContabil -> textoDocumento
 */
import s4DotzClient from "@/database/clients/s4DotzClient";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

export interface ConfiguracaoContabilVexpense {
    tipoArApGl: string;
    tipoDocumento: string;
    textoDocumento: string;
}

export class ConfiguracaoContabilVexpenseRepository {
    /** @returns `null` quando a CIA não tem configuração VEX cadastrada. */
    async buscar(ciaId: number): Promise<ConfiguracaoContabilVexpense | null> {
        const config = await s4DotzClient.configuracaoContabil.findUnique({
            where: { ciaId_tipoProcesso: { ciaId, tipoProcesso: TipoProcesso.VEX } },
            select: { tipoContabilERP: true, tipoDocumentoERP: true, textoHeaderContabil: true },
        });
        if (!config) return null;
        return {
            tipoArApGl: config.tipoContabilERP,
            tipoDocumento: config.tipoDocumentoERP,
            textoDocumento: config.textoHeaderContabil ?? "",
        };
    }
}
