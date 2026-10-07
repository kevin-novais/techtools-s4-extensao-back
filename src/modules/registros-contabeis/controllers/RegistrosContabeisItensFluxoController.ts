import { Request, Response } from "express";
import { ItensFluxoCaixaListService } from "@/modules/registros-contabeis/services/ItensFluxoCaixaListService";

/** (DTZ-248) Lista de opções do dropdown Item Fluxo de Caixa (tabela item_fluxo_caixa). */
export class RegistrosContabeisItensFluxoController {
    async handle(_req: Request, res: Response) {
        const service = new ItensFluxoCaixaListService();
        const itens = await service.execute();

        return res.status(200).json({ itens });
    }
}
