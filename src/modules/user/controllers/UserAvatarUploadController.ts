import { Request, Response } from "express";
import { UserAvatarUploadService } from "@/modules/user/services/UserAvatarUploadService";
import AppError from "@/util/AppError";

export class UserAvatarUploadController {
    async handle(req: Request, res: Response) {
        if (!req.file) {
            throw new AppError("Arquivo não enviado", 400);
        }

        const filename = req.file.filename;
        const userId = req.user?.id!;

        const userAvatarUploadService = new UserAvatarUploadService();
        const user = await userAvatarUploadService.execute(userId, filename);

        return res.status(200).json(user);
    }
}

