import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { Perfil } from "@/@types/PermissionsTypes";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { GrupoUsuarioCreateController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioCreateController";
import { GrupoUsuarioListController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioListController";
import { GrupoUsuarioShowController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioShowController";
import { GrupoUsuarioUpdateController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioUpdateController";
import { GrupoUsuarioDeleteController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioDeleteController";
import { GrupoUsuarioRemoveUserController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioRemoveUserController";
import { GrupoUsuarioAddUserController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioAddUserController";
import { GrupoUsuarioListUsersController } from "@/modules/grupo-usuario/controllers/GrupoUsuarioListUsersController";

const grupoUsuarioRoutes: Router = Router();

grupoUsuarioRoutes.get(
    '/',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioListController().handle,
);

grupoUsuarioRoutes.get(
    '/:id/usuarios',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioListUsersController().handle,
);

grupoUsuarioRoutes.get(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioShowController().handle,
);

grupoUsuarioRoutes.post(
    '/',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioCreateController().handle,
);

grupoUsuarioRoutes.put(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioUpdateController().handle,
);

grupoUsuarioRoutes.delete(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioDeleteController().handle,
);

grupoUsuarioRoutes.post(
    '/:id/usuarios/:usuarioId',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioAddUserController().handle,
);

grupoUsuarioRoutes.delete(
    '/:id/usuarios/:usuarioId',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new GrupoUsuarioRemoveUserController().handle,
);

export default grupoUsuarioRoutes;

