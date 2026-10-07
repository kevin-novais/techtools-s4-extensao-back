import { StatusVendas } from "@/@types/VendasHeader/StatusVendasTypes";

/** Status em que o header aceita cadastro/edição manual de detalhes (DTZ-225). */
export const VENDAS_STATUS_EDITAVEL: readonly string[] = [
    StatusVendas.CADASTRO,
    StatusVendas.PENDENTE,
    StatusVendas.ERRO_PROC,
];

export function isVendaHeaderEditavel(status: string): boolean {
    return VENDAS_STATUS_EDITAVEL.includes(status);
}
