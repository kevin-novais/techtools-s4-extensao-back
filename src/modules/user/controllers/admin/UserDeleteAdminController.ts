import { Request, Response } from "express";
import { UserDeleteAdminService } from "@/modules/user/services/admin/UserDeleteAdminService";
import { z } from "zod";

const userDeleteAdminIdSchema = z.object({
    id: z.string()
});

export class UserDeleteAdminController {
    async handle(req: Request, res: Response) {
        const userId = userDeleteAdminIdSchema.parse(req.params).id;

        const userDeleteAdminService = new UserDeleteAdminService();
        const user = await userDeleteAdminService.execute(Number(userId));

        return res.status(200).json(user);
    }
}