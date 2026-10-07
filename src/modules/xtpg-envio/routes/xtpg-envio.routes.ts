import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { XtpgEnvioHeaderListController } from "@/modules/xtpg-envio/controllers/XtpgEnvioHeaderListController";
import { XtpgEnvioHeaderShowController } from "@/modules/xtpg-envio/controllers/XtpgEnvioHeaderShowController";
import { ReprocessarXtpgController } from "@/modules/xtpg-envio/controllers/ReprocessarXtpgController";

const xtpgEnvioRoutes: Router = Router();

// :fluxo = previsto | realizado
xtpgEnvioRoutes.get(
    "/:fluxo/headers",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new XtpgEnvioHeaderListController().handle,
);

xtpgEnvioRoutes.get(
    "/:fluxo/headers/:id",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new XtpgEnvioHeaderShowController().handle,
);

xtpgEnvioRoutes.post(
    "/:fluxo/reprocessar",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ReprocessarXtpgController().handle,
);

export default xtpgEnvioRoutes;
