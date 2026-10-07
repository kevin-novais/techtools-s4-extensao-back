import { type Request, type Response, type NextFunction } from 'express';
import { getUserCiaIds } from '@/modules/documento-fiscal/utils/getUserCiaIds';

/**
 * Middleware que carrega as CIAs que o usuário tem acesso
 * e adiciona em req.user.ciaIds
 * 
 * Deve ser usado após ensureAuthenticate
 */
export async function ensureCiaAccess(req: Request, res: Response, next: NextFunction) {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
        return next();
    }

    const ciaIds = await getUserCiaIds(usuarioId);
    
    if (req.user) {
        req.user.ciaIds = ciaIds;
    }

    next();
}

