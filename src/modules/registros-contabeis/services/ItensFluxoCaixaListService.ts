import { ItemFluxoCaixa } from "@prisma/client-s4-dotz";
import s4DotzClient from "@/database/clients/s4DotzClient";

export interface ItemFluxoCaixaDTO {
    codigo: string;
    nome: string;
}

/** (DTZ-248) Lista as opções válidas do Item Fluxo de Caixa (tabela item_fluxo_caixa). */
export class ItensFluxoCaixaListService {
    async execute(): Promise<ItemFluxoCaixaDTO[]> {
        const itens = await s4DotzClient.itemFluxoCaixa.findMany();

        // Ordena numericamente pelo código (a coluna é texto: "2" viria depois de "19").
        return itens
            .map((i: ItemFluxoCaixa) => ({ codigo: i.codigo, nome: i.nome }))
            .sort(
                (a: ItemFluxoCaixaDTO, b: ItemFluxoCaixaDTO) =>
                    (Number(a.codigo) - Number(b.codigo)) || a.codigo.localeCompare(b.codigo),
            );
    }
}
