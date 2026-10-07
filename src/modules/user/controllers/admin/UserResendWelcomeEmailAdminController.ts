import { Request, Response } from "express";
import { z } from "zod";
import { UserResendWelcomeEmailAdminService } from "@/modules/user/services/admin/UserResendWelcomeEmailAdminService";

const paramsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export class UserResendWelcomeEmailAdminController {
    async handle(req: Request, res: Response) {
        const { id: userId } = paramsSchema.parse(req.params);

        const service = new UserResendWelcomeEmailAdminService();
        const result = await service.execute({ userId });

        return res.status(200).json(result);
    }
}
