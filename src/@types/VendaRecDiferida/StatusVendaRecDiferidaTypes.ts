export const StatusVendaRecDiferida = {
    PENDENTE: "PENDENTE",
    INTEGRADO: "INTEGRADO",
    ERRO_INTEG: "ERRO_INTEG",
    REVERSAO_PENDENTE: "REVERSAO_PENDENTE",
    REVERTIDO: "REVERTIDO",
    ERRO_REVERT: "ERRO_REVERT",
} as const;

export type StatusVendaRecDiferida = typeof StatusVendaRecDiferida[keyof typeof StatusVendaRecDiferida];

/** Transições de estado válidas */
export const TRANSICOES_VALIDAS: Record<StatusVendaRecDiferida, StatusVendaRecDiferida[]> = {
    [StatusVendaRecDiferida.PENDENTE]: [StatusVendaRecDiferida.INTEGRADO, StatusVendaRecDiferida.ERRO_INTEG],
    [StatusVendaRecDiferida.INTEGRADO]: [StatusVendaRecDiferida.REVERSAO_PENDENTE],
    [StatusVendaRecDiferida.ERRO_INTEG]: [StatusVendaRecDiferida.PENDENTE, StatusVendaRecDiferida.INTEGRADO, StatusVendaRecDiferida.ERRO_INTEG],
    [StatusVendaRecDiferida.REVERSAO_PENDENTE]: [StatusVendaRecDiferida.REVERTIDO, StatusVendaRecDiferida.ERRO_REVERT],
    [StatusVendaRecDiferida.REVERTIDO]: [],
    [StatusVendaRecDiferida.ERRO_REVERT]: [StatusVendaRecDiferida.REVERSAO_PENDENTE, StatusVendaRecDiferida.REVERTIDO, StatusVendaRecDiferida.ERRO_REVERT],
};

export function isTransicaoValida(
    statusAtual: StatusVendaRecDiferida,
    proximoStatus: StatusVendaRecDiferida,
): boolean {
    return TRANSICOES_VALIDAS[statusAtual]?.includes(proximoStatus) ?? false;
}
