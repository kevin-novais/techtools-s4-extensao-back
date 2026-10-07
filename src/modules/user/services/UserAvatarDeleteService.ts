import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { UploadDiskStorageService } from "@/util/services/upload.service";
import { buildPublicFileUrl } from "@/util/file-url";

export class UserAvatarDeleteService {
    private uploadService = new UploadDiskStorageService();

    async execute(userId: number) {
        const userExist = await s4DotzClient.usuario.findUnique({
            where: { 
                id: userId 
            },
            select: {
                id: true,
                avatarUrl: true,
            },
        });

        if (!userExist) {
            throw new AppError("Usuário não encontrado", 404);
        }

        if (!userExist.avatarUrl) {
            throw new AppError("Usuário não possui avatar para deletar", 400);
        }

        const filename = this.uploadService.extractFilenameFromUrl(userExist.avatarUrl);
        await this.uploadService.cleanupFile(filename, "avatars");

        const user = await s4DotzClient.usuario.update({
            where: { id: userId },
            data: {
                avatarUrl: null,
                atualizadoPor: userId,
                atualizadoEm: new Date()
            },
            select: {
                id: true,
                avatarUrl: true,
                atualizadoEm: true,
            },
        });

        return {
            ...user,
            avatarUrl: buildPublicFileUrl(user.avatarUrl),
            atualizadoEm: formatDateToBrazilianTimezone(user.atualizadoEm)
        };
    }
}

