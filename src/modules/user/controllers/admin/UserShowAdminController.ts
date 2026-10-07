import { Request, Response } from "express";
import { z } from "zod";
import { UserShowAdminService } from "@/modules/user/services/admin/UserShowAdminService";

const userShowAdminIdSchema = z.object({
    id: z.string()
});

export class UserShowAdminController {
    async handle(req: Request, res: Response) {
        const userId = userShowAdminIdSchema.parse(req.params).id;

        const userShowAdminService = new UserShowAdminService();
        const user = await userShowAdminService.execute(Number(userId));

        return res.status(200).json(user);
    }
}

