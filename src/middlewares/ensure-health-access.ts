/**
 * DTZ-320 - autorização do GET /health. Aceita, no mesmo header Authorization: Bearer:
 *   (1) a APP_API_KEY  -> acesso máquina-a-máquina (curl da virada, monitor externo);
 *   (2) um JWT de usuário com perfil ADMIN -> a tela da aba Administrador usa a própria
 *       sessão logada, sem que a APP_API_KEY vá para o navegador.
 * Falha -> 401 (sem credencial/JWT inválido) ou 403 (logado, mas não é ADMIN).
 */
import jwt from 'jsonwebtoken';
import { type Response, type NextFunction } from 'express';
import AppError from '@/util/AppError';
import { Config } from '@/config/config';
import { Perfil } from '@/@types/PermissionsTypes';
import { AuthRequest } from '@/middlewares/ensure-authenticated';
import s4DotzClient from '@/database/clients/s4DotzClient';

function extractBearer(authHeader: string | string[] | undefined): string | undefined {
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return undefined;
    }
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : undefined;
}

export async function ensureHealthAccess(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
    const token = extractBearer(req.headers.authorization);
    if (!token) {
        throw new AppError('Unauthorized', 401);
    }

    // (1) chave de aplicação (integração / curl)
    if (Config.APP_API_KEY && token === Config.APP_API_KEY) {
        next();
        return;
    }

    // (2) JWT de usuário ADMIN
    let decoded: { id?: string };
    try {
        decoded = jwt.verify(token, Config.ACCESS_TOKEN_SECRET) as { id?: string };
    } catch {
        throw new AppError('Unauthorized', 401);
    }

    const user = await s4DotzClient.usuario.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, ativo: true, perfil: true },
    });

    if (!user || !user.ativo) {
        throw new AppError('Unauthorized', 401);
    }
    if (user.perfil !== Perfil.ADMIN) {
        throw new AppError('Acesso negado', 403);
    }

    req.user = user;
    next();
}
