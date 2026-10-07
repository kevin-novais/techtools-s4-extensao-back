import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { ContasBancariasListController } from "@/modules/contas-bancarias/controllers/ContasBancariasListController";
import { ContasBancariasCreateController } from "@/modules/contas-bancarias/controllers/ContasBancariasCreateController";
import { ContasBancariasShowController } from "@/modules/contas-bancarias/controllers/ContasBancariasShowController";
import { ContasBancariasUpdateController } from "@/modules/contas-bancarias/controllers/ContasBancariasUpdateController";
import { ContasBancariasDeleteController } from "@/modules/contas-bancarias/controllers/ContasBancariasDeleteController";

const contasBancariasRoutes: Router = Router();

contasBancariasRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasBancariasListController().handle,
);

contasBancariasRoutes.post(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasBancariasCreateController().handle,
);

contasBancariasRoutes.get(
    "/:codigoCia/:houseBank/:houseBankAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasBancariasShowController().handle,
);

contasBancariasRoutes.put(
    "/:codigoCia/:houseBank/:houseBankAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasBancariasUpdateController().handle,
);

contasBancariasRoutes.delete(
    "/:codigoCia/:houseBank/:houseBankAccount",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ContasBancariasDeleteController().handle,
);

export default contasBancariasRoutes;
