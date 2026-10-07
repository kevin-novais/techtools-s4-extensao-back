export const TipoErro = {
  DIVERGENCIA: "DIVERGENCIA",
  ERRO: "ERRO",
} as const;

export type TipoErro = typeof TipoErro[keyof typeof TipoErro];

