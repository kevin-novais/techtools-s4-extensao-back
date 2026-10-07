export const TipoDocumentoERP = {
  TP_ROM: "TP_ROM", // Troca de pontos - Romaneio
  TP_POS: "TP_POS", // Troca de pontos - POS
  DR: "DR", // Venda de pontos
  PD: "PD", // Promo Dotz
  RD: "RD", // Receitas Diferidas
} as const;

export type TipoDocumentoERP = typeof TipoDocumentoERP[keyof typeof TipoDocumentoERP];

