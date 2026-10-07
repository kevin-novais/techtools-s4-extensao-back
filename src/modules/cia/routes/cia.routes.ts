import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { Perfil } from "@/@types/PermissionsTypes";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { CIACreateController } from "@/modules/cia/controllers/CIACreateController";
import { CIAListController } from "@/modules/cia/controllers/CIAListController";
import { CIAUpdateController } from "@/modules/cia/controllers/CIAUpdateController";
import { CIADeleteController } from "@/modules/cia/controllers/CIADeleteController";
import { CIAListUserAccessController } from "@/modules/cia/controllers/CIAListUserAccessController";

const ciaRoutes: Router = Router();

ciaRoutes.get(
    '/',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new CIAListController().handle,
);

ciaRoutes.post(
    '/',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new CIACreateController().handle,
);

ciaRoutes.put(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new CIAUpdateController().handle,
);

ciaRoutes.delete(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new CIADeleteController().handle,
);

ciaRoutes.get(
    '/list-user-access',
    ensureAuthenticate,
    new CIAListUserAccessController().handle,
);

export default ciaRoutes;