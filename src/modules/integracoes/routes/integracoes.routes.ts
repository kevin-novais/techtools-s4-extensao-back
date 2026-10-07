import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { IntegracoesListController } from "@/modules/integracoes/controllers/IntegracoesListController";
import { RunIntegracaoController } from "@/modules/integracoes/controllers/RunIntegracaoController";

const integracoesRoutes: Router = Router();

integracoesRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new IntegracoesListController().handle,
);

integracoesRoutes.post(
    "/:key/run",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RunIntegracaoController().handle,
);

export default integracoesRoutes;
