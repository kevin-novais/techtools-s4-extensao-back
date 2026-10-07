import { Request, Response } from "express";
import { z } from "zod";
import { GrupoUsuarioUpdateService } from "@/modules/grupo-usuario/services/GrupoUsuarioUpdateService";
import { parseDateAsBrazilian } from "@/util/date";

const grupoUsuarioUpdateIdSchema = z.object({
    id: z.string(),
});

const grupoUsuarioUpdateSchema = z.object({
    nome: z.string().min(1, { message: "Nome é obrigatório" }).optional(),
    dataInicio: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data de início inválida" }).optional(),
    dataFim: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Data de fim inválida" }).optional(),
    aprovaDivergencia: z.boolean({ message: "Aprova divergência é obrigatório" }).optional(),
});

export class GrupoUsuarioUpdateController {
    async handle(req: Request, res: Response) {
        const grupoUsuarioId = grupoUsuarioUpdateIdSchema.parse(req.params).id;
        const data = grupoUsuarioUpdateSchema.parse(req.body);
        const atualizadoPor = req.user?.id!;

        const dataToUpdate = {
            ...data,
            dataInicio: data.dataInicio ? parseDateAsBrazilian(data.dataInicio) : undefined,
            dataFim: data.dataFim ? parseDateAsBrazilian(data.dataFim) : undefined,
            atualizadoPor,
        };

        const grupoUsuarioUpdateService = new GrupoUsuarioUpdateService();
        const grupoUsuario = await grupoUsuarioUpdateService.execute(Number(grupoUsuarioId), dataToUpdate);

        return res.status(200).json({
            message: "Grupo de usuário atualizado com sucesso",
            grupoUsuario,
        });
    }
}

