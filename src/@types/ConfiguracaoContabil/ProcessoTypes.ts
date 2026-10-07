export const TipoProcesso = {
    TP_ROM: "TP_ROM", // Troca de pontos - Romaneio
    TP_POS: "TP_POS", // Troca de pontos - POS
    DR: "DR", // Venda de pontos
    PD: "PD", // Promo Dotz
    RD: "RD", // Receitas Diferidas
    XTPG_R: "XTPG_R", // Retorno do XTPG (Saída -> LCM no S/4)
    VEX: "VEX", // Vexpense (reembolso de despesas -> AP no S/4)
} as const;

export type TipoProcesso = typeof TipoProcesso[keyof typeof TipoProcesso];

export const TipoDocumentoERP = {
    RE: "RE", // Troca de pontos (TP_ROM e TP_POS)
    DR: "DR", // Venda de pontos
    PD: "PD", // Promo Dotz
    RD: "RD", // Receitas Diferidas
    AB: "AB", // Lançamento contábil (Retorno do XTPG)
} as const;

export type TipoDocumentoERP = typeof TipoDocumentoERP[keyof typeof TipoDocumentoERP];

/** Mapeia tipoProcesso para tipoDocumentoERP SAP */
export function mapTipoProcessoToTipoDocumentoERP(tipoProcesso: string): string {
    if (tipoProcesso === TipoProcesso.TP_ROM || tipoProcesso === TipoProcesso.TP_POS) {
        return TipoDocumentoERP.RE;
    }
    return tipoProcesso;
}
