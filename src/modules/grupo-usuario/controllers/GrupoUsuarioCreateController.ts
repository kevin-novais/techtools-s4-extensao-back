import { Request, Response } from "express";
import z from "zod";
import { GrupoUsuarioCreateService } from "@/modules/grupo-usuario/services/GrupoUsuarioCreateService";
import { parseDateAsBrazilian } from "@/util/date";

const grupoUsuarioCreateSchema = z.object({
    ciaId: z.number().int().positive({ message: "CIA ID é obrigatório" }),
    nome: z.string().min(1, { message: "Nome é obrigatório" }),
    dataInicio: z.string({ message: "Data de início é obrigatório" }).refine((val) => !isNaN(Date.parse(val)), { message: "Data de início inválida" }),
    dataFim: z.string({ message: "Data de fim é obrigatório" }).refine((val) => !isNaN(Date.parse(val)), { message: "Data de fim inválida" }),
    aprovaDivergencia: z.boolean({ message: "Aprova divergência é obrigatório" }),
});

export class GrupoUsuarioCreateController {
    async handle(req: Request, res: Response) {
        const { ciaId, nome, dataInicio, dataFim, aprovaDivergencia } = grupoUsuarioCreateSchema.parse(req.body);

        const atualizadoPor = req.user?.id!;

        const grupoUsuarioCreateService = new GrupoUsuarioCreateService();

        const grupoUsuario = await grupoUsuarioCreateService.execute({
            ciaId,
            nome,
            dataInicio: parseDateAsBrazilian(dataInicio),
            dataFim: parseDateAsBrazilian(dataFim),
            aprovaDivergencia,
            atualizadoPor,
        });

        return res.status(201).json({
            message: "Grupo de usuário criado com sucesso",
            grupoUsuario,
        });
    }
}

