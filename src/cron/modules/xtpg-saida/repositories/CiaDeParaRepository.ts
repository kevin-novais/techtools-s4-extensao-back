/**
 * De-para de Empresa para a Saída XTPG.
 *
 * Regra (DTZ-289): o `PfjCodigo` que vem na resposta do DeepXRT é o código
 * numérico da empresa (`0101/0201/0301/0401`) e corresponde a `cia.cia_id_sap`.
 * Localiza o registro em `cia` por `cia_id_sap` e devolve o mesmo valor como
 * CompanyCode / codigoCia no S/4.
 *
 * Histórico: a premissa anterior (11/06) casava por `nome_base_dados_b1`, mas
 * isso confundia o `PfjCodigo` com o prefixo do campo `Lote` (que nos lotes
 * antigos vinha como "SBODotzSP…"). Conferido contra o homolog do DeepXRT em
 * 12/08: o `PfjCodigo` é numérico em 100% dos movimentos (2022→2026) e nunca é
 * o nome da base.
 */
import s4DotzClient from "@/database/clients/s4DotzClient";

export interface CiaResolvida {
    /** cia.id interno – usado p/ buscar a ConfiguracaoContabil (XTPG_R) */
    ciaId: number;
    /** cia.cia_id_sap – CompanyCode / codigoCia no S/4 */
    companyCode: string;
}

export class CiaDeParaRepository {
    /**
     * Resolve a CIA (id interno + CompanyCode) a partir do `PfjCodigo` do movimento.
     * @returns `null` se não houver de-para ou se cia_id_sap estiver vazio.
     */
    async resolver(pfjCodigo: string): Promise<CiaResolvida | null> {
        if (!pfjCodigo) return null;

        const cia = await s4DotzClient.cia.findFirst({
            where: {
                ciaIdSAP: pfjCodigo,
                deletadoEm: null,
            },
            select: { id: true, ciaIdSAP: true },
        });

        if (!cia?.ciaIdSAP) return null;
        return { ciaId: cia.id, companyCode: cia.ciaIdSAP };
    }
}
