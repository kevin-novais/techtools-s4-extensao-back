import { Request, Response } from "express";
import { PosGrupoListService } from "@/modules/documento-fiscal/documento-details/pos/services/PosGrupoListService";
import z from "zod";


const posGrupoListSchema = z.object({
    cursor: z.string().optional(),
    limit: z.string().optional().transform((val) => (val ? Number.parseInt(val, 10) : 20))
        .refine((val) => !Number.isNaN(val) && val > 0, {
            message: "Parâmetro 'limit' deve ser um número maior que 0",
        }),
    search: z.string().optional(),
});


export class PosGrupoListController {
    async handle(req: Request, res: Response) {
        const { cursor, limit, search } = posGrupoListSchema.parse(req.query);

        const posGrupoListService = new PosGrupoListService();
        const result = await posGrupoListService.execute({
            cursor,
            limit,
            search,
        }); 

        return res.status(200).json(result);
    }
}