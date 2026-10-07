import { Router } from "express";
import { AuthSessionController } from "@/modules/auth/controllers/AuthSessionController";
import { ForgotPasswordController } from "@/modules/auth/controllers/ForgotPasswordController";
import { ValidateResetTokenController } from "@/modules/auth/controllers/ValidateResetTokenController";
import { ResetPasswordController } from "@/modules/auth/controllers/ResetPasswordController";

const authRoutes: Router = Router();

authRoutes.post(
    '/', 
    new AuthSessionController().handle
);

authRoutes.post(
    '/forgot-password',
    new ForgotPasswordController().handle
);

authRoutes.get(
    '/validate-reset-token',
    new ValidateResetTokenController().handle
);

authRoutes.post(
    '/reset-password',
    new ResetPasswordController().handle
);

export default authRoutes;