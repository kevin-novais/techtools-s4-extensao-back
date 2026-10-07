import { Router } from "express";
import { AccountfyRegistrosContabeisWebhookController } from "@/modules/webhooks/accountfy/controllers/AccountfyRegistrosContabeisWebhookController";
import { ensureApiKey } from "@/middlewares/ensure-apikey";

const accountfyWebhookRoutes: Router = Router();

accountfyWebhookRoutes.get(
    "/registros-contabeis",
    ensureApiKey,
    new AccountfyRegistrosContabeisWebhookController().handle,
);

export default accountfyWebhookRoutes;
