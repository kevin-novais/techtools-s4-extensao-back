import { Perfil } from "@/@types/PermissionsTypes";
import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";

interface UserUpdateAdminServiceProps {
    nome?: string;
    ativo?: boolean;
    perfil?: Perfil;
}
export class UserUpdateAdminService {
    async execute(userId: number, data: UserUpdateAdminServiceProps) {

        const userExist = await s4DotzClient.usuario.findUnique({
            where: { id: userId },
        });

        if (!userExist) {
            throw new AppError("Usuário não encontrado", 404);
        }

        const updateData: UserUpdateAdminServiceProps = {
            ...data,
        }

        if (data.perfil) {
            updateData.perfil = data.perfil;
        }

        const user = await s4DotzClient.usuario.update({
            where: { id: userId },
            data: {
                ...updateData,
                atualizadoPor: userId,
                atualizadoEm: new Date()
            },
        });

        return {
            ...user,
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm)
        };
    }
}