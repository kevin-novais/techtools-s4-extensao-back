import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { ControleExpenseListController } from "@/modules/controle-expense/controllers/ControleExpenseListController";
import { ControleExpenseShowController } from "@/modules/controle-expense/controllers/ControleExpenseShowController";
import { ReprocessarControleExpenseController } from "@/modules/controle-expense/controllers/ReprocessarControleExpenseController";
import { ReprocessarControleExpenseLoteController } from "@/modules/controle-expense/controllers/ReprocessarControleExpenseLoteController";

const controleExpenseRoutes: Router = Router();

controleExpenseRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ControleExpenseListController().handle,
);

controleExpenseRoutes.post(
    "/reprocessar-lote",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ReprocessarControleExpenseLoteController().handle,
);

controleExpenseRoutes.get(
    "/:id",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ControleExpenseShowController().handle,
);

controleExpenseRoutes.post(
    "/:id/reprocessar",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ReprocessarControleExpenseController().handle,
);

export default controleExpenseRoutes;
