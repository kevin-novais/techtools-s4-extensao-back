import { Router } from "express";
import multer from "multer";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import uploadConfig from "@/config/upload";
import { ContasContabeisListController } from "@/modules/contas-contabeis/controllers/ContasContabeisListController";
import { ContasContabeisCreateController } from "@/modules/contas-contabeis/controllers/ContasContabeisCreateController";
import { ContasContabeisShowController } from "@/modules/contas-contabeis/controllers/ContasContabeisShowController";
import { ContasContabeisUpdateController } from "@/modules/contas-contabeis/controllers/ContasContabeisUpdateController";
import { ContasContabeisDeleteController } from "@/modules/contas-contabeis/controllers/ContasContabeisDeleteController";
import { ContasContabeisImportController } from "@/modules/contas-contabeis/controllers/ContasContabeisImportController";
import { ContasContabeisExportController } from "@/modules/contas-contabeis/controllers/ContasContabeisExportController";
import { ContasContabeisImportTemplateController } from "@/modules/contas-contabeis/controllers/ContasContabeisImportTemplateController";

const contasContabeisRoutes: Router = Router();
const uploadXlsx = multer(uploadConfig.MULTER_XLSX);

contasContabeisRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisListController().handle,
);

contasContabeisRoutes.post(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisCreateController().handle,
);

contasContabeisRoutes.post(
    "/import",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    uploadXlsx.single("arquivo"),
    new ContasContabeisImportController().handle,
);

contasContabeisRoutes.get(
    "/export",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisExportController().handle,
);

contasContabeisRoutes.get(
    "/import-template",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisImportTemplateController().handle,
);

contasContabeisRoutes.get(
    "/:chartOfAccounts/:companyCode/:glAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisShowController().handle,
);

contasContabeisRoutes.put(
    "/:chartOfAccounts/:companyCode/:glAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisUpdateController().handle,
);

contasContabeisRoutes.delete(
    "/:chartOfAccounts/:companyCode/:glAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasContabeisDeleteController().handle,
);

export default contasContabeisRoutes;
