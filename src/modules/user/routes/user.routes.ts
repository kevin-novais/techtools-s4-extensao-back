import { Router } from "express";
import { UserCreateAdminController } from "@/modules/user/controllers/admin/UserCreateAdminController";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { UserDetailsController } from "@/modules/user/controllers/UserDetailsController";
import { UserListController } from "@/modules/user/controllers/admin/UserListAdminController";
import { UserUpdateController } from "@/modules/user/controllers/UserUpdateController";
import { UserUpdateAdminController } from "@/modules/user/controllers/admin/UserUpdateAdminController";
import { UserDeleteAdminController } from "@/modules/user/controllers/admin/UserDeleteAdminController";
import { UserShowAdminController } from "@/modules/user/controllers/admin/UserShowAdminController";
import { UserResendWelcomeEmailAdminController } from "@/modules/user/controllers/admin/UserResendWelcomeEmailAdminController";
import { UserAvatarUploadController } from "@/modules/user/controllers/UserAvatarUploadController";
import { UserAvatarDeleteController } from "@/modules/user/controllers/UserAvatarDeleteController";
import uploadConfig from "@/config/upload";
import multer from "multer";

const uploadAvatar = multer(uploadConfig.MULTER);

const userRoutes: Router = Router();

// Rotas de usuário

userRoutes.get(
    '/me',
    ensureAuthenticate,
    new UserDetailsController().handle
);


userRoutes.put(
    '/',
    ensureAuthenticate,
    new UserUpdateController().handle
);

userRoutes.post(
    '/avatar',
    ensureAuthenticate,
    uploadAvatar.single('avatar'),
    new UserAvatarUploadController().handle
);

userRoutes.delete(
    '/avatar',
    ensureAuthenticate,
    new UserAvatarDeleteController().handle
);

// Rotas administrativas

userRoutes.get(
    '/admin',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserListController().handle
);

userRoutes.post(
    '/admin',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserCreateAdminController().handle
);

userRoutes.get(
    '/admin/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserShowAdminController().handle
);

userRoutes.put(
    '/admin/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserUpdateAdminController().handle
);


userRoutes.delete(
    '/admin/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserDeleteAdminController().handle
);

userRoutes.post(
    '/admin/:id/reenviar-email',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new UserResendWelcomeEmailAdminController().handle
);


export default userRoutes;