import jwt from 'jsonwebtoken';
import { type Request, type Response, type NextFunction } from 'express';
import AppError from '@/util/AppError';
import { Config } from '@/config/config';
import s4DotzClient from '@/database/clients/s4DotzClient';


// estendendo o tipo Request para incluir "user"
export interface AuthRequest extends Request {
    user?: any;
}

export async function ensureAuthenticate(req: AuthRequest, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new AppError("Token ausente", 401);

    let decoded: any;
    try {
        decoded = jwt.verify(token, Config.ACCESS_TOKEN_SECRET);
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError("Token expirado", 401);
        }
        throw new AppError("Token inválido", 401);
    }

    const user = await s4DotzClient.usuario.findUnique({
        where: {
            id: decoded.id
        },
        select: {
            id: true,
            email: true,
            ativo: true,
            perfil: true,
        }
    });

    if (!user) throw new AppError("Usuário não encontrado", 404);
    if (!user.ativo) throw new AppError("Usuário inativo", 401);

    req.user = user;
    next();
}
