import { NextFunction, Response } from "express";
import { AuthRequest } from "@/middlewares/ensure-authenticated";
import AppError from "@/util/AppError";
import { Perfil } from "@/@types/PermissionsTypes";




export function permissionsRequired(allowedRoles: Perfil | Perfil[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const allowedRolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!user?.perfil || !allowedRolesArray.includes(user.perfil as Perfil)) {
      throw new AppError("Acesso negado", 403);
    }

    next();
  };
}
