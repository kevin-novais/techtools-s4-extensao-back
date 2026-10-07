import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { RegistrosContabeisListController } from "@/modules/registros-contabeis/controllers/RegistrosContabeisListController";
import { RegistrosContabeisItensFluxoController } from "@/modules/registros-contabeis/controllers/RegistrosContabeisItensFluxoController";
import { RegistrosContabeisUpdateItemFluxoController } from "@/modules/registros-contabeis/controllers/RegistrosContabeisUpdateItemFluxoController";

const registrosContabeisRoutes: Router = Router();

registrosContabeisRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RegistrosContabeisListController().handle,
);

registrosContabeisRoutes.get(
    "/itens-fluxo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RegistrosContabeisItensFluxoController().handle,
);

registrosContabeisRoutes.put(
    "/:companyCode/:fiscalYear/:accountingDocument/:accountingDocumentItem/item-fluxo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RegistrosContabeisUpdateItemFluxoController().handle,
);

export default registrosContabeisRoutes;
