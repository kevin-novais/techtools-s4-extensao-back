/**
 * Busca a Configuração Contábil do processo XTPG_R (Retorno do XTPG) para a CIA.
 *
 * Definição do dev (DTZ-227): `tipoArApGl`, `tipoDocumento` e `textoDocumento`
 * do LCM vêm da tabela `configuracao_contabil_header`, chaveada por
 * (ciaId, tipoProcesso='XTPG_R'):
 *   - tipoContabilERP    -> tipoArApGl   (ex.: GL)
 *   - tipoDocumentoERP   -> tipoDocumento (ex.: AB)
 *   - textoHeaderContabil-> textoDocumento (ex.: "Xtpg ")
 */
import s4DotzClient from "@/database/clients/s4DotzClient";
import { TipoProcesso } from "@/@types/ConfiguracaoContabil/ProcessoTypes";

export interface ConfiguracaoContabilXtpg {
    tipoArApGl: string;
    tipoDocumento: string;
    textoDocumento: string;
}

export class ConfiguracaoContabilXtpgRepository {
    /** @returns `null` quando a CIA não tem configuração XTPG_R cadastrada. */
    async buscar(ciaId: number): Promise<ConfiguracaoContabilXtpg | null> {
        const config = await s4DotzClient.configuracaoContabil.findUnique({
            where: {
                ciaId_tipoProcesso: { ciaId, tipoProcesso: TipoProcesso.XTPG_R },
            },
            select: {
                tipoContabilERP: true,
                tipoDocumentoERP: true,
                textoHeaderContabil: true,
            },
        });

        if (!config) return null;
        return {
            tipoArApGl: config.tipoContabilERP,
            tipoDocumento: config.tipoDocumentoERP,
            textoDocumento: config.textoHeaderContabil ?? "",
        };
    }
}
