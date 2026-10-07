import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";

export class UserDeleteAdminService {
    async execute(userId: number) {
        const userExist = await s4DotzClient.usuario.findUnique({
            where: { id: userId },
        });

        if (!userExist) {
            throw new AppError("Usuário não encontrado", 404);
        }

        const user = await s4DotzClient.usuario.delete({
            where: { id: userId },
        });

        return user;
    }
}