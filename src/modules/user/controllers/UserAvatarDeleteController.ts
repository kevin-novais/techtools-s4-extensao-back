import { Request, Response } from "express";
import { UserAvatarDeleteService } from "@/modules/user/services/UserAvatarDeleteService";

export class UserAvatarDeleteController {
    async handle(req: Request, res: Response) {
        const userId = req.user?.id!;

        const userAvatarDeleteService = new UserAvatarDeleteService();
        const user = await userAvatarDeleteService.execute(userId);

        return res.status(200).json(user);
    }
}

