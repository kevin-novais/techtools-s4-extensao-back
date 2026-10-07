import { Request, Response } from "express";
import { UserDetailsService } from "@/modules/user/services/UserDetailsService";

export class UserDetailsController {
    async handle(req: Request, res: Response) {
        const userId = req.user?.id!;
        const userDetailsService = new UserDetailsService();
        const user = await userDetailsService.execute(userId);
        return res.status(200).json(user);
    }
}